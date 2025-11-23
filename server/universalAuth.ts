// Universal Authentication System - Portable & Secure
// Works anywhere with PostgreSQL - no external dependencies
// DUAL AUTH: Supports both local (email/password) and OAuth (Replit) authentication
import bcrypt from "bcrypt";
import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import session from "express-session";
import type { Express, RequestHandler } from "express";
import connectPg from "connect-pg-simple";
import { storage } from "./storage";
import { authLimiter } from "./rateLimiting";
import { registerUserSchema, loginUserSchema, type RegisterUser, type LoginUser } from "@shared/schema";
import { db } from "./db";
import { creditWallets, creditLedger } from "@shared/schema";
import { setupReplitAuth } from "./replitAuth";
import { getRolePermissions } from "@shared/rbac";

const SALT_ROUNDS = 12; // Bcrypt salt rounds (higher = more secure, slower)

// Create session store singleton - shared between HTTP and WebSocket
const sessionTtl = 7 * 24 * 60 * 60 * 1000; // 1 week
const pgStore = connectPg(session);

// SSL configuration for production (Render PostgreSQL requires SSL)
const storeConfig = process.env.NODE_ENV === 'production'
  ? {
      conObject: {
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false },
      },
      createTableIfMissing: false,
      ttl: sessionTtl,
      tableName: "sessions",
    }
  : {
      conString: process.env.DATABASE_URL,
      createTableIfMissing: false,
      ttl: sessionTtl,
      tableName: "sessions",
    };

// Export session store singleton for WebSocket reuse
// CRITICAL: This ensures HTTP and WebSocket share the SAME session store
// No duplicate PostgreSQL connections, no session data out-of-sync
export const sessionStore = new pgStore(storeConfig);

// Create secure session middleware using singleton store
export function getSession() {
  return session({
    secret: process.env.SESSION_SECRET!,
    store: sessionStore, // Use singleton store
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true, // Prevent XSS attacks
      secure: process.env.NODE_ENV === "production", // HTTPS only in production
      maxAge: sessionTtl,
      sameSite: "lax", // CSRF protection
    },
  });
}

// Hash password with bcrypt
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS);
}

// Verify password with bcrypt
export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

// Setup universal authentication
export async function setupAuth(app: Express) {
  app.set("trust proxy", 1);
  app.use(getSession());
  app.use(passport.initialize());
  app.use(passport.session());

  // Local Strategy (email/password)
  passport.use(
    new LocalStrategy(
      {
        usernameField: "email",
        passwordField: "password",
      },
      async (email, password, done) => {
        try {
          console.log("[AUTH] Login attempt for email:", email);
          
          // Find user by email
          const users = await storage.getUserByEmail(email);
          console.log("[AUTH] Found users:", users ? users.length : 0);
          
          if (!users || users.length === 0) {
            console.log("[AUTH] No user found with email:", email);
            return done(null, false, { message: "Invalid email or password" });
          }
          
          const user = users[0];
          console.log("[AUTH] User found:", user.email, "has password:", !!user.password);
          
          // Check if user has password set (local auth)
          if (!user.password) {
            console.log("[AUTH] User has no password set");
            return done(null, false, { message: "Please use OAuth to login" });
          }
          
          // Verify password
          console.log("[AUTH] Verifying password...");
          const isValid = await verifyPassword(password, user.password);
          console.log("[AUTH] Password valid:", isValid);
          
          if (!isValid) {
            console.log("[AUTH] Password verification failed");
            return done(null, false, { message: "Invalid email or password" });
          }
          
          // Success - return user
          console.log("[AUTH] Authentication successful for:", email);
          return done(null, user);
        } catch (error) {
          console.error("[AUTH] Authentication error:", error);
          return done(error);
        }
      }
    )
  );

  // Serialize user for session (works for both local and OAuth users)
  passport.serializeUser((user: any, done) => {
    // OAuth users have a 'claims' object, local users have an 'id' directly
    const userId = user.claims?.sub || user.id;
    done(null, userId);
  });

  // Deserialize user from session (works for both local and OAuth users)
  passport.deserializeUser(async (id: string, done) => {
    try {
      const user = await storage.getUser(id);
      
      // CRITICAL FIX: Normalize user object after session deserialization
      // Issue: connect-pg-simple serializes sessions as plain JSON, losing Drizzle's
      // prototype-based getter that maps is_owner → isOwner
      // Solution: Explicitly ensure isOwner (camelCase) exists for middleware checks
      if (user) {
        const normalized = {
          ...user,
          isOwner: user?.isOwner ?? (user as any)?.is_owner ?? false
        };
        // Remove snake_case variant to prevent confusion
        delete (normalized as any).is_owner;
        done(null, normalized);
      } else {
        done(null, user);
      }
    } catch (error) {
      done(error);
    }
  });

  // DUAL AUTH: Setup Replit OAuth (Google/GitHub/X/Apple) alongside local auth
  // This shares the same session store and passport instance
  await setupReplitAuth(app);

  // Registration endpoint
  app.post("/api/auth/register", authLimiter, async (req, res) => {
    try {
      // Validate input
      const validatedData = registerUserSchema.parse(req.body);
      
      // Check if user already exists
      const existingUsers = await storage.getUserByEmail(validatedData.email);
      if (existingUsers && existingUsers.length > 0) {
        return res.status(400).json({ error: "Email already registered" });
      }
      
      // Hash password
      const hashedPassword = await hashPassword(validatedData.password);
      
      // Create user (local auth provider)
      const user = await storage.upsertUser({
        email: validatedData.email,
        password: hashedPassword,
        firstName: validatedData.firstName,
        lastName: validatedData.lastName,
        provider: "local", // Mark as local auth user
      });
      
      // Initialize credit wallet with starter credits (1000 credits = $50 value for testing)
      const STARTER_CREDITS = 1000;
      try {
        await db.insert(creditWallets).values({
          userId: user.id,
          availableCredits: STARTER_CREDITS,
          reservedCredits: 0,
          initialMonthlyCredits: STARTER_CREDITS,
        }).onConflictDoNothing();
        
        // Log credit allocation in ledger
        await db.insert(creditLedger).values({
          userId: user.id,
          deltaCredits: STARTER_CREDITS,
          source: 'monthly_allocation',
          metadata: {
            reason: 'New user starter credits',
          },
        });
        
        console.log(`[AUTH] Created credit wallet for new user ${user.email} with ${STARTER_CREDITS} starter credits`);
      } catch (walletError) {
        console.error('[AUTH] Failed to create credit wallet:', walletError);
        // Don't fail registration if wallet creation fails
      }
      
      // Log user in automatically
      req.login(user, (err) => {
        if (err) {
          return res.status(500).json({ error: "Login failed after registration" });
        }
        
        // Return user data (without password)
        const { password, ...userWithoutPassword } = user;
        res.json({ 
          success: true, 
          user: userWithoutPassword 
        });
      });
    } catch (error: any) {
      if (error.name === "ZodError") {
        return res.status(400).json({ 
          error: "Validation failed", 
          details: error.errors 
        });
      }
      console.error("Registration error:", error);
      res.status(500).json({ error: "Registration failed" });
    }
  });

  // Login endpoint
  app.post("/api/auth/login", authLimiter, (req, res, next) => {
    try {
      // Validate input
      const validatedData = loginUserSchema.parse(req.body);
      
      passport.authenticate("local", (err: any, user: any, info: any) => {
        if (err) {
          return res.status(500).json({ error: "Authentication error" });
        }
        
        if (!user) {
          return res.status(401).json({ 
            error: info?.message || "Invalid email or password" 
          });
        }
        
        req.login(user, (loginErr) => {
          if (loginErr) {
            return res.status(500).json({ error: "Login failed" });
          }
          
          // Return user data (without password) with RBAC permissions
          const { password, ...userWithoutPassword } = user;
          const userRole = user.role || 'user';
          const permissions = getRolePermissions(userRole);
          
          res.json({ 
            success: true, 
            user: {
              ...userWithoutPassword,
              isOwner: user.isOwner || false,
              permissions,
            }
          });
        });
      })(req, res, next);
    } catch (error: any) {
      if (error.name === "ZodError") {
        return res.status(400).json({ 
          error: "Validation failed", 
          details: error.errors 
        });
      }
      res.status(500).json({ error: "Login failed" });
    }
  });

  // Logout endpoint
  const logoutHandler = (req: any, res: any) => {
    req.session.destroy((err: any) => {
      if (err) {
        console.error("Session destruction error:", err);
      }
      req.logout(() => {
        res.clearCookie("connect.sid");
        
        // For POST requests (AJAX), return JSON
        if (req.method === "POST") {
          return res.json({ success: true });
        }
        
        // For GET requests (direct navigation), redirect
        res.redirect("/");
      });
    });
  };

  app.get("/api/auth/logout", authLimiter, logoutHandler);
  app.post("/api/auth/logout", authLimiter, logoutHandler);

  // Get current user endpoint
  app.get("/api/auth/me", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ error: "Not authenticated" });
    }
    
    const user = req.user as any;
    const { password, ...userWithoutPassword } = user;
    const userRole = user.role || 'user';
    const permissions = getRolePermissions(userRole);
    
    res.json({ 
      user: {
        ...userWithoutPassword,
        isOwner: user.isOwner || false,
        permissions,
      }
    });
  });
}

// Authentication middleware
export const isAuthenticated: RequestHandler = (req, res, next) => {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  
  const user = req.user as any;
  if (!user || !user.id) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  
  // Set canonical authenticated user ID
  (req as any).authenticatedUserId = user.id;
  next();
};

// Admin middleware
export const isAdmin: RequestHandler = async (req, res, next) => {
  // First verify authentication
  return isAuthenticated(req, res, async (err?: any) => {
    if (err) {
      return next(err);
    }

    // Use canonical authenticated user ID
    const userId = (req as any).authenticatedUserId;
    const user = await storage.getUser(userId);

    if (!user || user.role !== 'admin') {
      return res.status(403).json({ error: "Forbidden - Admin access required" });
    }

    next();
  });
};

// Owner middleware
export const isOwner: RequestHandler = async (req, res, next) => {
  // First verify authentication
  return isAuthenticated(req, res, async (err?: any) => {
    if (err) {
      return next(err);
    }

    // Use canonical authenticated user ID
    const userId = (req as any).authenticatedUserId;
    const user = await storage.getUser(userId);

    if (!user || !user.isOwner) {
      return res.status(403).json({ error: "Forbidden - Owner access required" });
    }

    next();
  });
};

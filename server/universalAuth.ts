// Universal Authentication System - Portable & Secure
// Works anywhere with PostgreSQL - no external dependencies
import bcrypt from "bcrypt";
import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import session from "express-session";
import type { Express, RequestHandler } from "express";
import connectPg from "connect-pg-simple";
import { storage } from "./storage";
import { authLimiter } from "./rateLimiting";
import { registerUserSchema, loginUserSchema, type RegisterUser, type LoginUser } from "@shared/schema";

const SALT_ROUNDS = 12; // Bcrypt salt rounds (higher = more secure, slower)

// Create secure session store
export function getSession() {
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
  
  const sessionStore = new pgStore(storeConfig);
  
  return session({
    secret: process.env.SESSION_SECRET!,
    store: sessionStore,
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
          // Find user by email
          const users = await storage.getUserByEmail(email);
          
          if (!users || users.length === 0) {
            return done(null, false, { message: "Invalid email or password" });
          }
          
          const user = users[0];
          
          // Check if user has password set (local auth)
          if (!user.password) {
            return done(null, false, { message: "Please use OAuth to login" });
          }
          
          // Verify password
          const isValid = await verifyPassword(password, user.password);
          
          if (!isValid) {
            return done(null, false, { message: "Invalid email or password" });
          }
          
          // Success - return user
          return done(null, user);
        } catch (error) {
          return done(error);
        }
      }
    )
  );

  // Serialize user for session
  passport.serializeUser((user: any, done) => {
    done(null, user.id);
  });

  // Deserialize user from session
  passport.deserializeUser(async (id: string, done) => {
    try {
      const user = await storage.getUser(id);
      done(null, user);
    } catch (error) {
      done(error);
    }
  });

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
      
      // Create user
      const user = await storage.upsertUser({
        email: validatedData.email,
        password: hashedPassword,
        firstName: validatedData.firstName,
        lastName: validatedData.lastName,
      });
      
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
          
          // Return user data (without password)
          const { password, ...userWithoutPassword } = user;
          res.json({ 
            success: true, 
            user: userWithoutPassword 
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
    res.json({ user: userWithoutPassword });
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
    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const dbUser = await storage.getUser(userId);

    if (!dbUser || dbUser.role !== "admin") {
      return res.status(403).json({ error: "Forbidden. Admin access required." });
    }

    return next();
  });
};

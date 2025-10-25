import type { Express } from "express";
import { storage } from "../storage";
import { isAuthenticated } from "../universalAuth";
import session from "express-session";
import connectPg from "connect-pg-simple";
import passport from "passport";
import { pool } from "../db";

const pgSession = connectPg(session);
const sessionStore = new pgSession({
  pool: pool,
  createTableIfMissing: false,
  tableName: "sessions",
});

export function registerAuthRoutes(app: Express) {
  // Configure session middleware
  app.use(session({
    store: sessionStore,
    secret: process.env.SESSION_SECRET || 'development-secret-change-in-production',
    resave: false,
    saveUninitialized: false,
    cookie: {
      maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax', // Allow cross-site for production
    },
    proxy: process.env.NODE_ENV === 'production', // Trust proxy headers from Render
  }));

  // Initialize Passport middleware
  app.use(passport.initialize());
  app.use(passport.session());

  // Login endpoint
  app.post('/api/auth/login', (req, res, next) => {
    passport.authenticate('local', (err: any, user: any, info: any) => {
      if (err) {
        console.error('Login error:', {
          error: err.message || err,
          stack: err.stack,
          env: process.env.NODE_ENV,
          secure: req.secure,
          protocol: req.protocol,
        });
        return res.status(500).json({ message: err.message || 'Internal server error' });
      }
      if (!user) {
        return res.status(401).json({ message: info?.message || 'Invalid credentials' });
      }
      req.logIn(user, (err: any) => {
        if (err) {
          console.error('Login session error:', err);
          return res.status(500).json({ message: 'Failed to establish login session' });
        }
        // Ensure session is saved and then respond
        req.session.save(() => {
          res.json({ user, message: "Login successful" });
        });
      });
    })(req, res, next);
  });


  // GET /api/auth/user - Get current authenticated user
  app.get("/api/auth/user", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.authenticatedUserId;
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }
      res.json(user);
    } catch (error) {
      console.error('Error fetching user:', error);
      res.status(500).json({ error: "Failed to fetch user" });
    }
  });

  // POST /api/auth/logout - Logout user
  app.post("/api/auth/logout", (req: any, res) => {
    req.logout((err: any) => {
      if (err) {
        console.error('Logout error:', err);
        return res.status(500).json({ error: "Logout failed" });
      }
      req.session.destroy((err: any) => {
        if (err) {
          console.error('Session destroy error:', err);
          return res.status(500).json({ error: "Failed to destroy session" });
        }
        res.clearCookie('connect.sid');
        res.json({ success: true, message: "Logged out successfully" });
      });
    });
  });
}
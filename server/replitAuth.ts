// Replit OAuth Integration - Dual Authentication System
// Integrates with Replit's OIDC provider for OAuth login (Google, GitHub, X, Apple)
// Works alongside local email/password auth in universalAuth.ts

import * as client from "openid-client";
import { Strategy, type VerifyFunction } from "openid-client/passport";
import passport from "passport";
import type { Express } from "express";
import memoize from "memoizee";
import { storage } from "./storage";
import { creditWallets, creditLedger } from "@shared/schema";
import { db } from "./db";

const getOidcConfig = memoize(
  async () => {
    return await client.discovery(
      new URL(process.env.ISSUER_URL ?? "https://replit.com/oidc"),
      process.env.REPL_ID!
    );
  },
  { maxAge: 3600 * 1000 }
);

function updateUserSession(
  user: any,
  tokens: client.TokenEndpointResponse & client.TokenEndpointResponseHelpers
) {
  user.claims = tokens.claims();
  user.access_token = tokens.access_token;
  user.refresh_token = tokens.refresh_token;
  user.expires_at = user.claims?.exp;
}

async function upsertOAuthUser(claims: any) {
  console.log('[REPLIT_AUTH] Upserting OAuth user with claims:', {
    sub: claims["sub"],
    email: claims["email"],
    first_name: claims["first_name"],
    last_name: claims["last_name"],
  });
  
  // Upsert user with OAuth provider info
  const user = await storage.upsertUser({
    id: claims["sub"], // Use Replit's sub as the user ID
    email: claims["email"],
    firstName: claims["first_name"],
    lastName: claims["last_name"],
    profileImageUrl: claims["profile_image_url"],
    provider: "replit", // Mark as OAuth user
    providerId: claims["sub"], // Store OAuth user ID
    password: null, // OAuth users don't have passwords
  });
  
  console.log('[REPLIT_AUTH] User upserted:', user.email);
  
  // Initialize credit wallet for new OAuth users (if not exists)
  try {
    const STARTER_CREDITS = 1000;
    await db.insert(creditWallets).values({
      userId: user.id,
      availableCredits: STARTER_CREDITS,
      reservedCredits: 0,
      initialMonthlyCredits: STARTER_CREDITS,
    }).onConflictDoNothing();
    
    // Log credit allocation in ledger (only if wallet was newly created)
    const existingWallet = await db.query.creditWallets.findFirst({
      where: (wallets, { eq }) => eq(wallets.userId, user.id)
    });
    
    if (existingWallet && existingWallet.availableCredits === STARTER_CREDITS) {
      await db.insert(creditLedger).values({
        userId: user.id,
        deltaCredits: STARTER_CREDITS,
        source: 'monthly_allocation',
        metadata: {
          reason: 'New OAuth user starter credits',
          provider: 'replit',
        },
      });
      
      console.log(`[REPLIT_AUTH] Created credit wallet for ${user.email} with ${STARTER_CREDITS} starter credits`);
    }
  } catch (walletError) {
    console.error('[REPLIT_AUTH] Failed to create credit wallet:', walletError);
    // Don't fail auth if wallet creation fails
  }
  
  return user;
}

/**
 * Setup Replit OAuth authentication
 * NOTE: This function DOES NOT create session middleware - it expects
 * session and passport to already be initialized by universalAuth.ts
 */
export async function setupReplitAuth(app: Express) {
  console.log('[REPLIT_AUTH] Setting up Replit OAuth...');
  
  const config = await getOidcConfig();

  const verify: VerifyFunction = async (
    tokens: client.TokenEndpointResponse & client.TokenEndpointResponseHelpers,
    verified: passport.AuthenticateCallback
  ) => {
    // Create OAuth session object (different from database User)
    const user: any = {};
    updateUserSession(user, tokens);
    await upsertOAuthUser(tokens.claims());
    verified(null, user);
  };

  // Keep track of registered strategies
  const registeredStrategies = new Set<string>();

  // Helper function to ensure strategy exists for a domain
  const ensureStrategy = (domain: string) => {
    const strategyName = `replitauth:${domain}`;
    if (!registeredStrategies.has(strategyName)) {
      console.log(`[REPLIT_AUTH] Registering strategy for domain: ${domain}`);
      const strategy = new Strategy(
        {
          name: strategyName,
          config,
          scope: "openid email profile offline_access",
          callbackURL: `https://${domain}/api/callback`,
        },
        verify,
      );
      passport.use(strategy);
      registeredStrategies.add(strategyName);
    }
  };

  // OAuth login route - /api/login (separate from local /api/auth/login)
  app.get("/api/login", (req, res, next) => {
    console.log(`[REPLIT_AUTH] Login request from domain: ${req.hostname}`);
    ensureStrategy(req.hostname);
    passport.authenticate(`replitauth:${req.hostname}`, {
      prompt: "login consent",
      scope: ["openid", "email", "profile", "offline_access"],
    })(req, res, next);
  });

  // OAuth callback route
  app.get("/api/callback", (req, res, next) => {
    console.log(`[REPLIT_AUTH] Callback request from domain: ${req.hostname}`);
    ensureStrategy(req.hostname);
    passport.authenticate(`replitauth:${req.hostname}`, {
      successReturnToOrRedirect: "/dashboard", // Redirect to dashboard after OAuth login
      failureRedirect: "/api/login",
    })(req, res, next);
  });

  // OAuth logout route - /api/logout (separate from local /api/auth/logout)
  app.get("/api/logout", (req, res) => {
    console.log('[REPLIT_AUTH] Logout request');
    req.logout(() => {
      res.redirect(
        client.buildEndSessionUrl(config, {
          client_id: process.env.REPL_ID!,
          post_logout_redirect_uri: `${req.protocol}://${req.hostname}`,
        }).href
      );
    });
  });
  
  console.log('[REPLIT_AUTH] Replit OAuth setup complete');
}

/**
 * Middleware to check if user is authenticated (for protected routes)
 * Works with both OAuth and local auth sessions
 */
export async function isAuthenticated(req: any, res: any, next: any) {
  const user = req.user as any;

  // Check if authenticated at all
  if (!req.isAuthenticated()) {
    return res.status(401).json({ message: "Unauthorized" });
  }
  
  // If user has OAuth tokens (Replit Auth user)
  if (user.expires_at) {
    const now = Math.floor(Date.now() / 1000);
    
    // Token still valid
    if (now <= user.expires_at) {
      return next();
    }

    // Try to refresh token
    const refreshToken = user.refresh_token;
    if (!refreshToken) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    try {
      const config = await getOidcConfig();
      const tokenResponse = await client.refreshTokenGrant(config, refreshToken);
      updateUserSession(user, tokenResponse);
      return next();
    } catch (error) {
      console.error('[REPLIT_AUTH] Token refresh failed:', error);
      return res.status(401).json({ message: "Unauthorized" });
    }
  }
  
  // Local auth user (no OAuth tokens) - already authenticated by passport
  return next();
}

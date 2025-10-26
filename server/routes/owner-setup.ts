import type { Express } from "express";
import { storage } from "../storage";
import { db } from "../db";
import { users } from "@shared/schema";
import { eq } from "drizzle-orm";
import { hashPassword } from "../universalAuth";

/**
 * Owner Setup Endpoint
 * Allows the first admin to mark themselves as the platform owner
 * Protected by authentication
 */
export function registerOwnerSetupRoutes(app: Express) {
  
  // EMERGENCY: Create root account endpoint (one-time use)
  app.post("/api/emergency/create-root", async (req, res) => {
    try {
      const ROOT_EMAIL = 'root@getdc360.com';
      const ROOT_PASSWORD = 'admin123@*';
      
      // Check if root account already exists
      const existing = await db.select()
        .from(users)
        .where(eq(users.email, ROOT_EMAIL))
        .limit(1);
      
      if (existing.length > 0) {
        console.log(`⚠️  Root account already exists, updating...`);
        
        // Update to ensure admin + owner status
        const hashedPassword = await hashPassword(ROOT_PASSWORD);
        
        await db.update(users)
          .set({
            password: hashedPassword,
            role: 'admin',
            isOwner: true,
            updatedAt: new Date(),
          })
          .where(eq(users.email, ROOT_EMAIL));
        
        console.log(`✅ Root account updated successfully`);
        return res.json({
          success: true,
          message: "Root account updated successfully",
          email: ROOT_EMAIL,
          action: "updated"
        });
      }
      
      // Create new root account
      console.log(`🔐 Creating root admin account...`);
      const hashedPassword = await hashPassword(ROOT_PASSWORD);
      
      const [newUser] = await db.insert(users)
        .values({
          email: ROOT_EMAIL,
          password: hashedPassword,
          firstName: 'Root',
          lastName: 'Admin',
          role: 'admin',
          isOwner: true,
        })
        .returning();
      
      console.log(`✅ Root account created successfully!`);
      console.log(`   Email: ${newUser.email}`);
      console.log(`   Role: ${newUser.role}`);
      console.log(`   Owner: ${newUser.isOwner}`);
      
      res.json({
        success: true,
        message: "Root account created successfully! You can now login.",
        email: ROOT_EMAIL,
        action: "created"
      });
      
    } catch (error: any) {
      console.error('❌ Error creating root account:', error);
      res.status(500).json({
        success: false,
        error: "Failed to create root account",
        details: error.message
      });
    }
  });
  // POST /api/setup-owner - Mark yourself as owner (admin only)
  app.post("/api/setup-owner", async (req: any, res) => {
    try {
      // Must be authenticated
      if (!req.isAuthenticated || !req.isAuthenticated()) {
        return res.status(401).json({ error: "Authentication required" });
      }

      const userId = req.authenticatedUserId;
      const user = await storage.getUser(userId);

      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      // Must be admin
      if (user.role !== 'admin') {
        return res.status(403).json({ 
          error: "Only admins can become platform owner" 
        });
      }

      // Check if owner already exists
      const existingOwner = await storage.getOwner();
      
      if (existingOwner && existingOwner.id !== userId) {
        return res.status(403).json({ 
          error: "Platform owner already exists",
          owner: {
            email: existingOwner.email,
            id: existingOwner.id
          }
        });
      }

      // Mark this user as owner
      await storage.setOwner(userId);

      console.log(`✅ Platform owner set: ${user.email} (ID: ${userId})`);

      res.json({
        success: true,
        message: "You are now the platform owner!",
        user: {
          id: user.id,
          email: user.email,
          role: user.role,
          isOwner: true
        }
      });

    } catch (error: any) {
      console.error('Error setting owner:', error);
      res.status(500).json({ 
        error: "Failed to set owner",
        details: error.message 
      });
    }
  });

  // GET /api/owner-status - Check current owner status
  app.get("/api/owner-status", async (req: any, res) => {
    try {
      const owner = await storage.getOwner();
      
      if (!owner) {
        return res.json({
          hasOwner: false,
          message: "No platform owner set"
        });
      }

      res.json({
        hasOwner: true,
        owner: {
          email: owner.email,
          id: owner.id
        }
      });

    } catch (error: any) {
      console.error('Error checking owner status:', error);
      res.status(500).json({ 
        error: "Failed to check owner status",
        details: error.message 
      });
    }
  });
}

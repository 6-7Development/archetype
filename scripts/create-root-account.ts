#!/usr/bin/env tsx
/**
 * Create Root Admin Account
 * Run this once to create the initial platform owner account
 * 
 * Usage: tsx scripts/create-root-account.ts
 */

import { db } from '../server/db';
import { users } from '../shared/schema';
import { eq } from 'drizzle-orm';
import * as bcrypt from 'bcrypt';

const ROOT_EMAIL = 'root@getdc360.com';
const ROOT_PASSWORD = 'admin123@*';
const SALT_ROUNDS = 10;

async function createRootAccount() {
  try {
    console.log('🔐 Creating root admin account...');
    console.log(`   Email: ${ROOT_EMAIL}`);
    
    // Check if account already exists
    const existing = await db.select()
      .from(users)
      .where(eq(users.email, ROOT_EMAIL))
      .limit(1);
    
    if (existing.length > 0) {
      console.log('⚠️  Account already exists!');
      console.log(`   Updating to admin/owner status...`);
      
      // Update existing account to be admin + owner
      const hashedPassword = await bcrypt.hash(ROOT_PASSWORD, SALT_ROUNDS);
      
      await db.update(users)
        .set({
          password: hashedPassword,
          role: 'admin',
          isOwner: true,
          firstName: 'Root',
          lastName: 'Admin',
          updatedAt: new Date(),
        })
        .where(eq(users.email, ROOT_EMAIL));
      
      console.log('✅ Account updated successfully!');
      console.log('   - Role: admin');
      console.log('   - Owner: true');
      console.log('   - Password: reset');
      return;
    }
    
    // Hash password
    console.log('🔒 Hashing password...');
    const hashedPassword = await bcrypt.hash(ROOT_PASSWORD, SALT_ROUNDS);
    
    // Create new account
    console.log('💾 Inserting into database...');
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
    
    console.log('✅ Root account created successfully!');
    console.log('   ID:', newUser.id);
    console.log('   Email:', newUser.email);
    console.log('   Role:', newUser.role);
    console.log('   Owner:', newUser.isOwner);
    console.log('');
    console.log('🎉 You can now login with:');
    console.log(`   Email: ${ROOT_EMAIL}`);
    console.log(`   Password: ${ROOT_PASSWORD}`);
    
  } catch (error) {
    console.error('❌ Error creating root account:', error);
    process.exit(1);
  } finally {
    process.exit(0);
  }
}

createRootAccount();

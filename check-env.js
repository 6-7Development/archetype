#!/usr/bin/env node

/**
 * Environment Variable Checker for Archetype Launch
 * Run with: node check-env.js
 */

const requiredVars = {
  'CRITICAL - Stripe Payment Processing': [
    'STRIPE_SECRET_KEY',
    'STRIPE_WEBHOOK_SECRET',
    'VITE_STRIPE_PUBLIC_KEY',
  ],
  'CRITICAL - Stripe Price IDs': [
    'STRIPE_PRICE_ID_STARTER',
    'STRIPE_PRICE_ID_PRO',
    'STRIPE_PRICE_ID_BUSINESS',
    'STRIPE_PRICE_ID_ENTERPRISE',
  ],
  'REQUIRED - Core Services': [
    'ANTHROPIC_API_KEY',
    'DATABASE_URL',
    'SESSION_SECRET',
  ],
  'OPTIONAL - Database Details': [
    'PGDATABASE',
    'PGHOST',
    'PGUSER',
    'PGPASSWORD',
    'PGPORT',
  ],
};

console.log('\n🚀 Archetype Environment Check\n');
console.log('='.repeat(60));

let hasErrors = false;
let totalVars = 0;
let setVars = 0;

for (const [category, vars] of Object.entries(requiredVars)) {
  console.log(`\n📋 ${category}:`);
  
  vars.forEach(varName => {
    totalVars++;
    const isSet = !!process.env[varName];
    const isCritical = category.includes('CRITICAL');
    
    if (isSet) {
      setVars++;
      const value = process.env[varName];
      const masked = varName.includes('KEY') || varName.includes('SECRET') || varName.includes('PASSWORD')
        ? `${value.substring(0, 4)}...${value.substring(value.length - 4)} (${value.length} chars)`
        : value.substring(0, 20) + (value.length > 20 ? '...' : '');
      console.log(`  ✅ ${varName}: ${masked}`);
    } else {
      if (isCritical) {
        hasErrors = true;
        console.log(`  ❌ ${varName}: NOT SET (BLOCKING LAUNCH)`);
      } else {
        console.log(`  ⚠️  ${varName}: NOT SET (optional)`);
      }
    }
  });
}

console.log('\n' + '='.repeat(60));
console.log(`\n📊 Summary: ${setVars}/${totalVars} variables configured`);

if (hasErrors) {
  console.log('\n❌ LAUNCH BLOCKED: Critical environment variables missing!');
  console.log('\n📖 Setup Instructions:');
  console.log('   1. Follow STRIPE_SETUP_GUIDE.md for Stripe configuration');
  console.log('   2. Add missing variables to Replit Secrets');
  console.log('   3. Restart the application');
  console.log('   4. Run this check again: node check-env.js\n');
  process.exit(1);
} else {
  console.log('\n✅ ALL SYSTEMS GO! Ready for launch! 🚀\n');
  process.exit(0);
}

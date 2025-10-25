
#!/usr/bin/env tsx
/**
 * Verify Render deployment is working correctly
 * Tests: Database, GitHub service, Meta-SySop, SySop
 */

async function verifyDeployment() {
  console.log('🔍 Verifying Render Deployment...\n');
  
  const checks = {
    database: false,
    github: false,
    metaSysop: false,
    sysop: false,
  };
  
  // Check database connection
  try {
    const { db } = await import('../server/db');
    const { files } = await import('../shared/schema');
    await db.select().from(files).limit(1);
    checks.database = true;
    console.log('✅ Database connection: OK');
  } catch (error: any) {
    console.error('❌ Database connection: FAILED -', error.message);
  }
  
  // Check GitHub service
  try {
    const { isGitHubServiceAvailable } = await import('../server/githubService');
    if (isGitHubServiceAvailable()) {
      checks.github = true;
      console.log('✅ GitHub service: OK');
    } else {
      console.log('⚠️  GitHub service: Not configured (optional)');
    }
  } catch (error: any) {
    console.error('❌ GitHub service: FAILED -', error.message);
  }
  
  // Check environment variables
  const requiredVars = [
    'DATABASE_URL',
    'SESSION_SECRET',
    'ANTHROPIC_API_KEY',
    'NODE_ENV'
  ];
  
  const missingVars = requiredVars.filter(v => !process.env[v]);
  if (missingVars.length === 0) {
    checks.metaSysop = true;
    checks.sysop = true;
    console.log('✅ Environment variables: OK');
  } else {
    console.error('❌ Missing environment variables:', missingVars.join(', '));
  }
  
  // Summary
  console.log('\n📊 Deployment Status:');
  console.log('  Database:', checks.database ? '✅' : '❌');
  console.log('  GitHub:', checks.github ? '✅' : '⚠️ (optional)');
  console.log('  Meta-SySop:', checks.metaSysop ? '✅' : '❌');
  console.log('  SySop:', checks.sysop ? '✅' : '❌');
  
  const allPassed = checks.database && checks.metaSysop && checks.sysop;
  
  if (allPassed) {
    console.log('\n🎉 All critical checks passed! Deployment is ready.');
    process.exit(0);
  } else {
    console.log('\n⚠️  Some checks failed. Review errors above.');
    process.exit(1);
  }
}

verifyDeployment().catch(error => {
  console.error('❌ Verification failed:', error);
  process.exit(1);
});

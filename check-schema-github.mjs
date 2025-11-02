import { Octokit } from '@octokit/rest';

const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });
const [owner, repo] = (process.env.GITHUB_REPO || '').split('/');

async function checkFile() {
  try {
    const { data } = await octokit.repos.getContent({
      owner, repo,
      path: 'shared/schema.ts',
      ref: 'main'
    });
    
    const content = Buffer.from(data.content, 'base64').toString('utf-8');
    const hasBuildJobs = content.includes('export const buildJobs');
    
    console.log(`buildJobs export exists in GitHub: ${hasBuildJobs}`);
    
    if (!hasBuildJobs) {
      console.log('\n❌ buildJobs table is MISSING from GitHub!');
      console.log('This needs to be committed.');
    } else {
      console.log('\n✅ buildJobs table exists in GitHub');
      console.log('The issue might be something else...');
    }
  } catch (error) {
    console.error('Error:', error.message);
  }
}

checkFile();

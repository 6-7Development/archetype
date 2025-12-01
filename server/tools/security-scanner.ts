/**
 * Gap #9: Security Scanning Tool
 * Detects OWASP patterns, secret exposure, SQL injection, XSS vulnerabilities
 * Callable by Scout agent to proactively identify security issues
 */

import * as fs from 'fs';
import * as path from 'path';

export interface SecurityIssue {
  severity: 'critical' | 'high' | 'medium' | 'low';
  type: string;
  file: string;
  line?: number;
  description: string;
  recommendation: string;
  cwe?: string;
}

export interface SecurityScanResult {
  success: boolean;
  scannedFiles: number;
  issues: SecurityIssue[];
  summary: {
    critical: number;
    high: number;
    medium: number;
    low: number;
    total: number;
  };
  scanDuration: number;
}

const SECRET_PATTERNS = [
  { pattern: /(?:api[_-]?key|apikey)\s*[:=]\s*['"][a-zA-Z0-9_\-]{20,}['"]/gi, type: 'API Key Exposure', cwe: 'CWE-798' },
  { pattern: /(?:secret|password|passwd|pwd)\s*[:=]\s*['"][^'"]{8,}['"]/gi, type: 'Hardcoded Secret', cwe: 'CWE-798' },
  { pattern: /(?:aws_access_key_id|aws_secret_access_key)\s*[:=]\s*['"][A-Z0-9]{16,}['"]/gi, type: 'AWS Credential', cwe: 'CWE-798' },
  { pattern: /(?:private[_-]?key|privatekey)\s*[:=]\s*['"]-----BEGIN/gi, type: 'Private Key Exposure', cwe: 'CWE-321' },
  { pattern: /ghp_[a-zA-Z0-9]{36}/g, type: 'GitHub Token', cwe: 'CWE-798' },
  { pattern: /sk-[a-zA-Z0-9]{48}/g, type: 'OpenAI API Key', cwe: 'CWE-798' },
  { pattern: /AIza[a-zA-Z0-9_\-]{35}/g, type: 'Google API Key', cwe: 'CWE-798' },
  { pattern: /sk_live_[a-zA-Z0-9]{24,}/g, type: 'Stripe Live Key', cwe: 'CWE-798' },
];

const SQL_INJECTION_PATTERNS = [
  { pattern: /\$\{[^}]*\}\s*(?:SELECT|INSERT|UPDATE|DELETE|FROM|WHERE)/gi, type: 'SQL Injection (Template Literal)', cwe: 'CWE-89' },
  { pattern: /['"`]\s*\+\s*(?:req\.|params\.|query\.|body\.)/gi, type: 'SQL Injection (String Concat)', cwe: 'CWE-89' },
  { pattern: /execute\s*\(\s*[`'"]\s*(?:SELECT|INSERT|UPDATE|DELETE)/gi, type: 'Raw SQL Execution', cwe: 'CWE-89' },
  { pattern: /db\.query\s*\(\s*[`'"]/gi, type: 'Unparameterized Query', cwe: 'CWE-89' },
];

const XSS_PATTERNS = [
  { pattern: /dangerouslySetInnerHTML\s*=\s*\{\s*\{\s*__html:\s*(?!sanitize)/gi, type: 'XSS (dangerouslySetInnerHTML)', cwe: 'CWE-79' },
  { pattern: /innerHTML\s*=\s*(?!DOMPurify|sanitize)/gi, type: 'XSS (innerHTML)', cwe: 'CWE-79' },
  { pattern: /document\.write\s*\(/gi, type: 'XSS (document.write)', cwe: 'CWE-79' },
  { pattern: /eval\s*\(\s*(?:req\.|params\.|query\.|body\.|user)/gi, type: 'Code Injection (eval)', cwe: 'CWE-94' },
  { pattern: /new\s+Function\s*\(\s*(?:req\.|params\.|query\.|body\.)/gi, type: 'Code Injection (new Function)', cwe: 'CWE-94' },
];

const AUTH_PATTERNS = [
  { pattern: /bcrypt\.compare\s*\([^)]*\)\s*\.then\s*\(\s*\(\s*\)\s*=>/gi, type: 'Auth Bypass (ignored compare result)', cwe: 'CWE-287' },
  { pattern: /jwt\.verify\s*\([^)]*,\s*['"].*['"].*algorithms:\s*\[['"]none['"]\]/gi, type: 'JWT Algorithm None', cwe: 'CWE-327' },
  { pattern: /password\s*===?\s*['"][^'"]+['"]/gi, type: 'Hardcoded Password Check', cwe: 'CWE-798' },
  { pattern: /session\.regenerate\s*=\s*false/gi, type: 'Session Fixation Risk', cwe: 'CWE-384' },
];

const CORS_PATTERNS = [
  { pattern: /Access-Control-Allow-Origin['":\s]+['"]\*['"]/gi, type: 'Permissive CORS', cwe: 'CWE-942' },
  { pattern: /cors\s*\(\s*\{\s*origin:\s*true/gi, type: 'CORS Origin True', cwe: 'CWE-942' },
];

const CRYPTO_PATTERNS = [
  { pattern: /createHash\s*\(\s*['"]md5['"]\)/gi, type: 'Weak Hash (MD5)', cwe: 'CWE-328' },
  { pattern: /createHash\s*\(\s*['"]sha1['"]\)/gi, type: 'Weak Hash (SHA1)', cwe: 'CWE-328' },
  { pattern: /crypto\.createCipher\s*\(/gi, type: 'Deprecated Crypto (createCipher)', cwe: 'CWE-327' },
  { pattern: /Math\.random\s*\(\s*\).*(?:token|secret|key|password|session)/gi, type: 'Insecure Random', cwe: 'CWE-330' },
];

const EXCLUDED_DIRS = [
  'node_modules',
  '.git',
  'dist',
  'build',
  '.next',
  'coverage',
  '__pycache__',
  '.cache',
  '.replit',
];

const SCANNABLE_EXTENSIONS = ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs'];
const MAX_FILE_SIZE = 500 * 1024;
const MAX_DEPTH = 10;
const MAX_FILES = 1000;

function getAllFiles(dir: string, files: string[] = [], depth: number = 0): string[] {
  if (depth > MAX_DEPTH || files.length >= MAX_FILES) return files;
  
  try {
    const items = fs.readdirSync(dir);
    for (const item of items) {
      if (files.length >= MAX_FILES) break;
      if (EXCLUDED_DIRS.includes(item) || item.startsWith('.')) continue;
      
      const fullPath = path.join(dir, item);
      try {
        const stat = fs.statSync(fullPath);
        
        if (stat.isDirectory()) {
          getAllFiles(fullPath, files, depth + 1);
        } else if (SCANNABLE_EXTENSIONS.some(ext => item.endsWith(ext))) {
          if (stat.size <= MAX_FILE_SIZE) {
            files.push(fullPath);
          }
        }
      } catch {
        continue;
      }
    }
  } catch {
    // Directory not accessible
  }
  return files;
}

function scanFile(filePath: string): SecurityIssue[] {
  const issues: SecurityIssue[] = [];
  
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.split('\n');
    const relativePath = filePath.replace(process.cwd() + '/', '');
    
    const allPatterns = [
      ...SECRET_PATTERNS.map(p => ({ ...p, severity: 'critical' as const, category: 'Secret Exposure' })),
      ...SQL_INJECTION_PATTERNS.map(p => ({ ...p, severity: 'critical' as const, category: 'SQL Injection' })),
      ...XSS_PATTERNS.map(p => ({ ...p, severity: 'high' as const, category: 'XSS' })),
      ...AUTH_PATTERNS.map(p => ({ ...p, severity: 'high' as const, category: 'Authentication' })),
      ...CORS_PATTERNS.map(p => ({ ...p, severity: 'medium' as const, category: 'CORS' })),
      ...CRYPTO_PATTERNS.map(p => ({ ...p, severity: 'medium' as const, category: 'Cryptography' })),
    ];
    
    for (let lineNum = 0; lineNum < lines.length; lineNum++) {
      const line = lines[lineNum];
      
      for (const { pattern, type, severity, cwe, category } of allPatterns) {
        pattern.lastIndex = 0;
        if (pattern.test(line)) {
          issues.push({
            severity,
            type,
            file: relativePath,
            line: lineNum + 1,
            description: `${category}: ${type} detected`,
            recommendation: getRecommendation(type),
            cwe,
          });
        }
      }
    }
  } catch {
    // File not readable
  }
  
  return issues;
}

function getRecommendation(type: string): string {
  const recommendations: Record<string, string> = {
    'API Key Exposure': 'Move API keys to environment variables (process.env)',
    'Hardcoded Secret': 'Use environment variables or a secrets manager',
    'AWS Credential': 'Use IAM roles or AWS Secrets Manager instead',
    'Private Key Exposure': 'Store private keys in secure vault, never in code',
    'GitHub Token': 'Use GitHub Apps or environment variables for tokens',
    'OpenAI API Key': 'Store in OPENAI_API_KEY environment variable',
    'Google API Key': 'Use environment variables, restrict key in Google Cloud Console',
    'Stripe Live Key': 'Store in STRIPE_SECRET_KEY environment variable',
    'SQL Injection (Template Literal)': 'Use parameterized queries (Drizzle ORM, prepared statements)',
    'SQL Injection (String Concat)': 'Never concatenate user input into SQL. Use parameterized queries',
    'Raw SQL Execution': 'Use ORM methods or parameterized queries',
    'Unparameterized Query': 'Use query parameters: db.query(sql, [param1, param2])',
    'XSS (dangerouslySetInnerHTML)': 'Use DOMPurify.sanitize() before setting HTML',
    'XSS (innerHTML)': 'Use textContent or sanitize with DOMPurify',
    'XSS (document.write)': 'Avoid document.write. Use DOM manipulation methods',
    'Code Injection (eval)': 'Never eval user input. Use JSON.parse for data',
    'Code Injection (new Function)': 'Avoid dynamic function creation with user input',
    'Auth Bypass (ignored compare result)': 'Always check the result of bcrypt.compare()',
    'JWT Algorithm None': 'Specify allowed algorithms: algorithms: ["RS256"]',
    'Hardcoded Password Check': 'Use bcrypt.compare() for password verification',
    'Session Fixation Risk': 'Regenerate session ID on login',
    'Permissive CORS': 'Specify allowed origins instead of wildcard (*)',
    'CORS Origin True': 'Explicitly list allowed origins',
    'Weak Hash (MD5)': 'Use SHA-256 or stronger for hashing',
    'Weak Hash (SHA1)': 'Use SHA-256 or stronger for hashing',
    'Deprecated Crypto (createCipher)': 'Use crypto.createCipheriv() with proper IV',
    'Insecure Random': 'Use crypto.randomBytes() for security-sensitive values',
  };
  return recommendations[type] || 'Review and fix this security issue';
}

export async function scanSecurity(input: { directory?: string; verbose?: boolean }): Promise<SecurityScanResult> {
  const startTime = Date.now();
  const targetDir = input.directory || process.cwd();
  
  console.log(`[SECURITY-SCAN] Starting security scan of ${targetDir}...`);
  
  const files = getAllFiles(targetDir);
  const allIssues: SecurityIssue[] = [];
  
  for (const file of files) {
    const fileIssues = scanFile(file);
    allIssues.push(...fileIssues);
  }
  
  const summary = {
    critical: allIssues.filter(i => i.severity === 'critical').length,
    high: allIssues.filter(i => i.severity === 'high').length,
    medium: allIssues.filter(i => i.severity === 'medium').length,
    low: allIssues.filter(i => i.severity === 'low').length,
    total: allIssues.length,
  };
  
  const duration = Date.now() - startTime;
  
  console.log(`[SECURITY-SCAN] Completed in ${duration}ms`);
  console.log(`[SECURITY-SCAN] Found ${summary.total} issues (${summary.critical} critical, ${summary.high} high)`);
  
  return {
    success: true,
    scannedFiles: files.length,
    issues: allIssues,
    summary,
    scanDuration: duration,
  };
}

export const SECURITY_SCAN_TOOL = {
  name: 'security_scan',
  description: 'Scan the codebase for security vulnerabilities including OWASP patterns, hardcoded secrets, SQL injection, XSS, and authentication issues. Returns a detailed report of all security issues found.',
  input_schema: {
    type: 'object',
    properties: {
      directory: {
        type: 'string',
        description: 'Directory to scan (defaults to project root)',
      },
      verbose: {
        type: 'boolean',
        description: 'Include detailed descriptions for each issue',
      },
    },
    required: [],
  },
};

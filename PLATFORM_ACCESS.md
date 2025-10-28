# Platform Access on Railway

## Directory Structure
```
/
├── dist/              # Compiled distribution files
├── server/            # Backend server code
├── shared/           # Shared utilities and types
├── drizzle.config.ts # Database configuration
├── package.json      # Node.js dependencies
├── railway-start.sh  # Railway deployment script
├── replit.md        # Platform documentation
└── tsconfig.json    # TypeScript configuration
```

## Available Access
- **Read Access**: All platform files and directories
- **Write Access**: Can create, modify, and delete platform files
- **Database Access**: Can execute SQL queries via execute_sql()
- **Log Access**: Can read server logs via read_logs()
- **Diagnostic Access**: Can analyze code via perform_diagnosis()

## Key Capabilities
1. **File Operations**
   - `readPlatformFile()` - Read any platform file
   - `writePlatformFile()` - Write/update platform files
   - `listPlatformDirectory()` - Browse directories
   - `createPlatformFile()` - Create new files
   - `deletePlatformFile()` - Remove files

2. **Project Operations**
   - `readProjectFile()` - Read user project files
   - `writeProjectFile()` - Write user project files
   - `listProjectDirectory()` - Browse user projects
   - `createProjectFile()` - Create user files
   - `deleteProjectFile()` - Remove user files

3. **System Operations**
   - `execute_sql()` - Run database queries
   - `read_logs()` - Check server logs
   - `perform_diagnosis()` - Analyze code issues
   - `commit_to_github()` - Deploy changes

## Railway Environment
- Platform runs on Railway cloud infrastructure
- Automatic deployments on git push
- Environment variables managed by Railway
- PostgreSQL database included
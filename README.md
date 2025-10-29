# CodeIDE - Self-Hosted Web IDE

A powerful self-hosted web IDE with AI-powered code generation and real-time collaboration features built with React, Monaco Editor, Express, PostgreSQL, and OpenAI.

## Features

- 🎨 **Monaco Editor Integration** - Full-featured code editor with syntax highlighting
- 🤖 **AI Code Assistant** - OpenAI-powered code generation and modification
- 📁 **File Management** - Create, edit, and save files with PostgreSQL persistence
- 🔄 **Real-time Sync** - WebSocket-based file synchronization
- 🌗 **Dark/Light Mode** - Beautiful IDE-themed interface
- 🐳 **Docker Ready** - Easy deployment with Docker Compose

## Tech Stack

### Frontend
- React with TypeScript
- Monaco Editor (VS Code's editor)
- Tailwind CSS + Shadcn UI
- TanStack Query (React Query)
- Wouter (routing)

### Backend
- Express.js
- PostgreSQL (Neon Serverless)
- WebSocket (ws)
- OpenAI API
- Drizzle ORM

## Prerequisites

- Node.js 20+
- PostgreSQL 16+
- OpenAI API Key ([Get one here](https://platform.openai.com/api-keys))
- Docker & Docker Compose (for containerized deployment)

## Local Development Setup

### 1. Clone the Repository

```bash
git clone <your-repo-url>
cd codide
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Configure Environment Variables

Create a `.env` file based on `.env.example`:

```bash
cp .env.example .env
```

Edit `.env` and add your configuration:

```env
# Database Configuration
PGDATABASE=codide
PGUSER=postgres
PGPASSWORD=your-password
PGHOST=localhost
PGPORT=5432
DATABASE_URL=postgresql://postgres:your-password@localhost:5432/codide

# OpenAI API Configuration
OPENAI_API_KEY=sk-your-openai-api-key

# Application Configuration
NODE_ENV=development
PORT=5000
SESSION_SECRET=your-random-secret
```

### 4. Set Up Database

Make sure PostgreSQL is running, then push the database schema:

```bash
npm run db:push
```

### 5. Start Development Server

```bash
npm run dev
```

The application will be available at `http://localhost:5000`

## Self-Hosting and Deployment

### Using Docker Compose (Recommended)

Docker Compose will set up both the application and PostgreSQL database.

#### 1. Configure Environment

Edit the `.env` file with your production settings:

```env
PGDATABASE=codide
PGUSER=postgres
PGPASSWORD=secure-password
OPENAI_API_KEY=sk-your-openai-api-key
```

#### 2. Build and Run

```bash
# Build and start all services
docker-compose up -d

# View logs
docker-compose logs -f

# Stop services
docker-compose down
```

The application will be available at `http://localhost:5000`

#### 3. Database Migrations

The database schema is automatically created. If you need to update it:

```bash
# Enter the app container
docker-compose exec app sh

# Push schema changes
npm run db:push
```

### Using Docker (Application Only)

If you have an external PostgreSQL database:

#### 1. Build the Image

```bash
docker build -t codide .
```

#### 2. Run the Container

```bash
docker run -d \
  -p 5000:5000 \
  -e DATABASE_URL="postgresql://user:pass@host:5432/dbname" \
  -e OPENAI_API_KEY="sk-your-key" \
  --name codide \
  codide
```

**Note**: The Docker image uses `tsx` to run TypeScript files directly in production for simplicity. For optimal performance in production, consider compiling TypeScript to JavaScript.

### Manual Deployment (VPS/Server)

#### 1. Install Dependencies

```bash
npm ci --only=production
```

#### 2. Build Frontend

```bash
npm run build
```

#### 3. Configure PostgreSQL

Ensure PostgreSQL is installed and running. Create a database:

```sql
CREATE DATABASE codide;
```

#### 4. Set Environment Variables

```bash
export DATABASE_URL="postgresql://user:pass@localhost:5432/codide"
export OPENAI_API_KEY="sk-your-key"
export NODE_ENV=production
```

#### 5. Push Database Schema

```bash
npm run db:push
```

#### 6. Start the Server

```bash
# Using tsx to run TypeScript directly
npx tsx server/index.ts

# Or use npm script
npm start
```

#### 7. Use a Process Manager (Optional but Recommended)

```bash
# Using PM2
npm install -g pm2
pm2 start "npx tsx server/index.ts" --name codide
pm2 save
pm2 startup
```

### Nginx Reverse Proxy (Optional)

For production deployments, use Nginx as a reverse proxy:

```nginx
server {
    listen 80;
    server_name your-domain.com;

    location / {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }

    # WebSocket support
    location /ws {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
```

## Environment Variables Reference

| Variable | Description | Required | Default |
|----------|-------------|----------|---------|
| `DATABASE_URL` | PostgreSQL connection string | Yes | - |
| `OPENAI_API_KEY` | OpenAI API key for AI features | Yes | - |
| `PGDATABASE` | PostgreSQL database name | Yes | codide |
| `PGUSER` | PostgreSQL username | Yes | postgres |
| `PGPASSWORD` | PostgreSQL password | Yes | - |
| `PGHOST` | PostgreSQL host | Yes | localhost |
| `PGPORT` | PostgreSQL port | Yes | 5432 |
| `PORT` | Application port | No | 5000 |
| `NODE_ENV` | Environment mode | No | development |
| `SESSION_SECRET` | Session encryption key | No | auto-generated |

## API Endpoints

### Files
- `GET /api/files` - List all files
- `POST /api/files` - Create a new file
- `PUT /api/files/:id` - Update file content
- `DELETE /api/files/:id` - Delete a file

### AI Chat
- `POST /api/ai-chat` - Generate code with AI
- `GET /api/chat/messages/:fileId` - Get chat history for a file

### WebSocket
- `ws://localhost:5000/ws` - Real-time file synchronization

## Usage

1. **Create a File**: Click the "+" button in the file explorer
2. **Edit Code**: Select a file and start coding in Monaco Editor
3. **Save Changes**: Click the "Save" button or use the auto-save feature
4. **AI Assistant**: Click "AI Chat" to open the AI panel
5. **Generate Code**: Ask the AI to create or modify code, and it will be injected into the editor

## Troubleshooting

### Database Connection Issues

```bash
# Check PostgreSQL status
docker-compose ps

# View database logs
docker-compose logs postgres

# Restart database
docker-compose restart postgres
```

### OpenAI API Errors

- Verify your API key is correct in `.env`
- Check you have credits available at https://platform.openai.com/usage
- Ensure the API key has proper permissions

### WebSocket Connection Failed

- Check firewall settings allow WebSocket connections
- Verify Nginx configuration includes WebSocket support
- Ensure the `/ws` path is not blocked

## Development

### Run Tests

```bash
npm test
```

### Database Migrations

```bash
# Generate migration
npm run db:generate

# Push changes to database
npm run db:push

# Force push (use with caution)
npm run db:push --force
```

### Code Structure

```
├── client/              # Frontend React application
│   ├── src/
│   │   ├── components/  # Reusable UI components
│   │   ├── pages/       # Page components
│   │   └── lib/         # Utilities and configs
├── server/              # Backend Express application
│   ├── routes.ts        # API routes and WebSocket
│   ├── storage.ts       # Database operations
│   ├── db.ts           # Database connection
│   └── openai.ts       # OpenAI client
├── shared/             # Shared types and schemas
│   └── schema.ts       # Drizzle schema definitions
└── docker-compose.yml  # Docker orchestration
```

## Advanced Features

### Anthropic Context Limit Wrapper

The platform includes a robust wrapper for Anthropic API calls that prevents context limit errors. For detailed usage instructions, see [ANTHROPIC_WRAPPER_GUIDE.md](./ANTHROPIC_WRAPPER_GUIDE.md).

Key features:
- Automatic token estimation and truncation
- Retry logic with exponential backoff
- Configurable via environment variables
- Unit tested with 20+ test cases

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

## License

MIT License - see LICENSE file for details

## Support

For issues and questions:
- Open an issue on GitHub
- Check existing documentation
- Review the troubleshooting section

---

Built with ❤️ using React, Monaco Editor, Express, and OpenAI
# Test auto-deploy
# Trigger rebuild

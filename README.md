# Database Admin Tool

A modern, AI-powered database administration tool built with Next.js, featuring intelligent query generation, comprehensive history tracking, multi-database support, and **enterprise-grade security**.

![Database Admin Tool](https://img.shields.io/badge/Database-Admin_Tool-blue.svg)
![Next.js](https://img.shields.io/badge/Next.js-15-black.svg)
![TypeScript](https://img.shields.io/badge/TypeScript-5-blue.svg)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-3-38B2AC.svg)
![Security](https://img.shields.io/badge/Security-Enterprise_Grade-green.svg)

## ✨ Features

### 🔒 **Enterprise Security Architecture**
- **Session-based authentication** - No credentials in API requests
- **Authorization headers** - Industry-standard Bearer token authentication
- **Server-side credential storage** - Credentials never transmitted after session creation
- **Automatic session expiration** - 24-hour security timeout
- **Session revocation** - Immediate access termination capability
- **Docker security** - Non-root user, minimal attack surface

### 🗄️ **Multi-Database Support**
- **MySQL** - Direct connections and proxy support
- **PostgreSQL** - Full-featured support
- **SQLite** - Local database files
- **MySQL Proxy** - Custom API proxy integration

### 🤖 **AI-Powered Query Generation**
- **Gemini 2.0 Flash Lite** integration
- Natural language to SQL conversion
- Schema-aware query generation
- Context-sensitive table and column suggestions
- Anti-hallucination prompting

### 📝 **Advanced SQL Editor**
- **CodeMirror** with SQL syntax highlighting
- **Smart autocomplete** with table/column suggestions
- **Multi-tab** query editing
- **Query history** with search and filtering
- **Auto-execution** from AI-generated queries

### 📊 **Comprehensive History System**
- **Query History** - Track all SQL executions with results
- **AI Prompt History** - Save prompts with context and generated queries
- **Search & Filter** - Find past queries and prompts easily
- **Statistics Dashboard** - Usage analytics and metrics
- **localStorage Persistence** - History survives browser sessions

### 🎨 **Modern UI/UX**
- **Dark/Light/System** theme support
- **Responsive design** for all devices
- **Real-time** query execution and results
- **Schema explorer** with expandable table structures
- **Secure connection management** with session-based authentication

## 🚀 Quick Start

### Prerequisites
- **Node.js** 18+ 
- **npm** or **yarn**
- **Google AI API Key** for AI features

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd db-admin-tool
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   ```bash
   cp .env.example .env.local
   ```
   
   Add your Google AI API key:
   ```env
   GOOGLE_API_KEY=your_google_gemini_api_key
   ```

4. **Run the development server**
   ```bash
   npm run dev
   ```

5. **Open your browser**
   Navigate to [http://localhost:3000](http://localhost:3000)

## 🐳 Docker Deployment

### Quick Start
```bash
# Using Docker Compose
docker-compose up -d

# Or manually
docker build -t db-admin-tool .
docker run -d -p 8008:8008 -e GOOGLE_API_KEY=your_key db-admin-tool
```

**Image Details:**
- Size: ~203MB (optimized multi-stage build)
- Base: Node 20 Alpine
- Security: Non-root user execution
- Port: 8008

See [`.cursor/docker.md`](.cursor/docker.md) for detailed deployment instructions.

## 🔧 Configuration

### Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `GOOGLE_API_KEY` | Google AI API key for Gemini integration | Yes |

### Secure Database Connections

The tool uses a **session-based security model**:

1. **Create Session**: Enter credentials once to establish a secure session
2. **Use Session**: All subsequent operations use session tokens
3. **Automatic Expiry**: Sessions expire after 24 hours
4. **Manual Revocation**: Sessions can be terminated immediately

#### Connection Types

**MySQL/PostgreSQL**
```typescript
{
  name: "My Database",
  type: "mysql", // or "postgresql"
  host: "localhost",
  port: 3306,
  database: "my_db",
  username: "user",
  password: "password" // Only sent during session creation
}
```

**SQLite**
```typescript
{
  name: "Local DB",
  type: "sqlite",
  filename: "/path/to/database.db"
}
```

**MySQL Proxy**
```typescript
{
  name: "Proxy DB",
  type: "mysql-proxy",
  host: "https://your-proxy-api.com/db", // Proxy URL
  server: "mysql-server-name",           // Actual MySQL server
  database: "database_name",
  username: "proxy_user",
  password: "proxy_password"
}
```

## 📚 Usage Guide

### 1. **Secure Session Management**
- Navigate to the **Secure Database Sessions** section
- Click **"New Session"** to create a secure connection
- Enter credentials once - they're stored securely on the server
- Session tokens are used for all subsequent operations
- Sessions auto-expire after 24 hours or can be manually revoked

### 2. **Query Execution**
- Use the **Query Editor** tab to write SQL
- Enjoy autocomplete suggestions for tables and columns
- Execute queries with **Ctrl+Enter** or the Execute button
- View results in an interactive table

### 3. **AI Query Generation**
- Switch to the **AI Generator** tab
- Describe what you want to query in natural language
- Select specific tables to include (optional)
- Click **"Generate SQL Query"**
- Use the generated query directly or modify as needed

### 4. **History Management**
- Access the **History** tab to view all past activity
- Search through queries and AI prompts
- Filter by connection or date
- Reuse any previous query or prompt with one click

### 5. **Schema Exploration**
- Use the **Explorer** tab in the sidebar
- Browse database tables and their structures
- View column details, types, and constraints
- Click any table to generate a basic SELECT query

## 🔒 Security

This application implements **enterprise-grade security**:

- ✅ **Session-based authentication** - No credentials in API requests
- ✅ **Authorization headers** - Bearer token authentication
- ✅ **Server-side credential storage** - Credentials never transmitted after initial session
- ✅ **Automatic session expiration** - 24-hour timeout
- ✅ **Manual session revocation** - Immediate access termination
- ✅ **Docker security** - Non-root user execution
- ✅ **Minimal attack surface** - Optimized for security

**Previous vulnerabilities (now fixed):**
- ❌ Database passwords in every HTTP request
- ❌ Credentials in network traffic and logs
- ❌ Credentials stored in browser memory
- ❌ No session management or access control

See [`.cursor/security.md`](.cursor/security.md) for detailed security architecture.

## 🛠️ Development

### Project Structure

```
src/
├── app/                    # Next.js app router
│   ├── api/               # API routes
│   │   ├── sessions/      # Secure session management
│   │   ├── query/         # Query execution with session auth
│   │   └── llm/          # AI query generation
│   ├── globals.css        # Global styles
│   ├── layout.tsx         # Root layout
│   └── page.tsx          # Main dashboard
├── components/            # React components
│   ├── ui/               # shadcn/ui components
│   ├── SecureConnectionManager.tsx # Session-based connections
│   ├── DatabaseExplorer.tsx
│   ├── LLMQueryGenerator.tsx
│   ├── QueryEditor.tsx
│   ├── QueryHistory.tsx
│   └── ThemeProvider.tsx
├── lib/                  # Utility libraries
│   ├── database/         # Database connections
│   ├── session-manager.ts # Secure session handling
│   ├── llm/             # AI query generation
│   ├── query-history.ts  # History management
│   └── sql-completions.ts # Autocomplete logic
└── types/               # TypeScript definitions
    └── database.ts
```

### Key Technologies

- **Next.js 15** - React framework with App Router
- **TypeScript** - Type safety and developer experience
- **Tailwind CSS** - Utility-first CSS framework
- **shadcn/ui** - High-quality React components
- **CodeMirror** - Advanced SQL editor
- **Google AI (Gemini)** - Natural language to SQL

## 📄 Documentation

- [Security Architecture](.cursor/security.md) - Detailed security implementation
- [Docker Deployment](.cursor/docker.md) - Container deployment guide
- [Development Instructions](.cursor/instructions.md) - Development setup and guidelines

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Ensure security best practices
5. Submit a pull request

## 📜 License

This project is licensed under the MIT License.

---

**Built with security in mind** 🔒 | **AI-powered** 🤖 | **Developer-friendly** 🛠️

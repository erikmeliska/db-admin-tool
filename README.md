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
- **Encrypted session persistence** - AES-encrypted file storage for session recovery
- **Docker security** - Non-root user, minimal attack surface

### 🗄️ **Multi-Database Support**
- **MySQL** - Direct connections and proxy support
- **PostgreSQL** - Full-featured support
- **SQLite** - Local database files
- **MySQL Proxy** - Custom API proxy integration
- **Case-sensitive table names** - Proper quoting for all database types

### 🤖 **AI-Powered Query Generation**
- **Gemini 2.0 Flash Lite** integration
- Natural language to SQL conversion
- Schema-aware query generation
- Context-sensitive table and column suggestions
- **Smart table selection** - Choose specific tables or use all
- **Query execution buttons** - Run queries directly or in new tabs
- **Reset functionality** - Clear forms with one click
- Anti-hallucination prompting

### 📝 **Advanced SQL Editor**
- **CodeMirror** with SQL syntax highlighting
- **Smart autocomplete** with table/column suggestions
- **Multi-tab** query editing with persistent state
- **Query history** with search and filtering
- **Auto-execution** from AI-generated queries
- **Performance optimized** - No cursor jumping or typing delays
- **Responsive editing** - Handles large queries without lag
- **Infinite loop prevention** - Robust state management

### 📊 **Comprehensive History System**
- **Dual History Types** - Separate SQL queries and AI prompts
- **Advanced Action Buttons**:
  - **SQL History**: "Use Query" and "Use in New Tab" buttons
  - **AI History**: "Use Prompt", "Run Query", and "Run in New Tab" buttons
- **Search & Filter** - Find past queries and prompts easily
- **Statistics Dashboard** - Usage analytics and metrics
- **Smart Storage Management** - Automatic cleanup of old sessions
- **Storage Optimization** - 99% reduction in localStorage usage
- **Quota Management** - Automatic recovery from storage limits
- **Persistent Sessions** - History survives browser sessions

### 🎨 **Modern UI/UX**
- **Dark/Light/System** theme support
- **Responsive design** for all devices
- **Collapsible sidebar** - Smart space management (48px ↔ 500px)
- **Auto-collapse** on table selection for better workflow
- **Real-time** query execution and results
- **Schema explorer** with expandable table structures
- **Interactive JSON display** - Smart visualization of JSON/JSONB fields
- **Manual cleanup utility** - 🧹 button for storage management

### ⚡ **Performance & Optimization**
- **Optimized Query Editor** - No cursor jumping or typing delays
- **Efficient State Management** - CodeMirror manages its own state
- **Smart Storage Management**:
  - Automatic cleanup of old session data (keeps only 5 recent sessions)
  - Truncated result storage (first 100 rows only)
  - Manual cleanup utility with real-time feedback
  - Graceful fallback when localStorage quota exceeded
- **Memory Efficient** - Stores only essential metadata
- **Responsive UI** - Smooth interactions even with large datasets
- **Tab Persistence** - Individual session tab management

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
5. **Persistent Recovery**: Sessions survive server restarts

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
- Navigate to the **Connections** tab in the sidebar
- Click **"New Session"** to create a secure connection
- Enter credentials once - they're stored securely on the server with AES encryption
- Session tokens are used for all subsequent operations
- Sessions auto-expire after 24 hours or can be manually revoked
- Sessions persist across server restarts

### 2. **Database Exploration**
- Use the **Explorer** tab in the collapsible sidebar
- Browse database tables and their structures
- View column details, types, and constraints
- Click any table to generate a basic SELECT query
- Sidebar auto-collapses for better workspace

### 3. **Query Execution**
- Use the **Query Editor** tab to write SQL
- Enjoy autocomplete suggestions for tables and columns
- Execute queries with **Ctrl+Enter** or the Execute button
- Multi-tab support with persistent state per session
- View results in an interactive table with JSON field support

### 4. **AI Query Generation**
- Switch to the **AI Generator** tab
- Describe what you want to query in natural language
- Select specific tables to include (optional - leave empty for all tables)
- Use **"Select All"** / **"Unselect All"** toggle for convenience
- Click **"Generate SQL Query"**
- Use action buttons:
  - **▶️ Run Query** - Execute in current tab
  - **🔗 Run in New Tab** - Create new tab and execute
- **🔄 Reset** button to clear form and start fresh

### 5. **History Management**
- Access the **History** tab to view all past activity
- **Three history types**: All History, SQL Queries, AI Prompts
- **Advanced action buttons**:
  - **SQL Queries**: ▶️ Use Query, 🔗 Use in New Tab
  - **AI Prompts**: 🧠 Use Prompt, ▶️ Run Query, 🔗 Run in New Tab
- Search through queries and prompts with real-time filtering
- Filter by connection or date
- Statistics dashboard showing usage metrics

### 6. **Storage Management**
- **Automatic cleanup** of old session data (keeps 5 recent sessions)
- **Manual cleanup** with 🧹 button in header
- **Storage optimization** prevents localStorage quota issues
- **Graceful fallback** when storage limits reached

## 🔒 Security

This application implements **enterprise-grade security**:

- ✅ **Session-based authentication** - No credentials in API requests
- ✅ **Authorization headers** - Bearer token authentication
- ✅ **Server-side credential storage** - Credentials never transmitted after initial session
- ✅ **AES encryption** - Session data encrypted at rest
- ✅ **Automatic session expiration** - 24-hour timeout
- ✅ **Manual session revocation** - Immediate access termination
- ✅ **Session persistence** - Survives server restarts securely
- ✅ **Docker security** - Non-root user execution
- ✅ **Minimal attack surface** - Optimized for security

## 🛠️ Development

### Recent Improvements

**v2.1.0 - Enhanced History & Storage Management**
- ✅ Advanced history action buttons (run query, run in new tab)
- ✅ Smart localStorage management with automatic cleanup
- ✅ Storage quota handling and manual cleanup utility
- ✅ AI query generator reset functionality
- ✅ Infinite loop prevention in query execution
- ✅ Improved tab persistence and state management

**v2.0.0 - Security & Performance Overhaul**
- ✅ Session-based security architecture
- ✅ Encrypted session persistence
- ✅ Performance optimized query editor
- ✅ Collapsible sidebar with auto-collapse
- ✅ Multi-tab query editing
- ✅ Case-sensitive table name support

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
│   └── page.tsx          # Main dashboard with storage management
├── components/            # React components
│   ├── ui/               # shadcn/ui components
│   ├── QueryEditor.tsx   # Multi-tab SQL editor with performance optimizations
│   ├── QueryHistory.tsx  # Advanced history with action buttons
│   ├── LLMQueryGenerator.tsx  # AI query generation with reset
│   ├── DatabaseExplorer.tsx   # Schema exploration
│   └── SecureConnectionManager.tsx  # Session management
├── lib/                   # Utilities
│   ├── session-manager.ts # AES-encrypted session persistence
│   ├── query-history.ts  # Dual history management
│   └── database/         # Database connection handlers
└── sessions/             # Encrypted session storage
```

### Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Commit your changes: `git commit -m 'Add amazing feature'`
4. Push to the branch: `git push origin feature/amazing-feature`
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- **Next.js** team for the amazing React framework
- **shadcn/ui** for beautiful, accessible UI components
- **CodeMirror** for the powerful SQL editor
- **Google AI** for Gemini integration
- **Tailwind CSS** for utility-first styling

# Database Admin Tool

A modern, AI-powered database administration tool built with Next.js, featuring intelligent query generation, comprehensive history tracking, and multi-database support.

![Database Admin Tool](https://img.shields.io/badge/Database-Admin_Tool-blue.svg)
![Next.js](https://img.shields.io/badge/Next.js-15-black.svg)
![TypeScript](https://img.shields.io/badge/TypeScript-5-blue.svg)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-3-38B2AC.svg)

## ✨ Features

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
- **Connection management** with test capabilities

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

## 🔧 Configuration

### Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `GOOGLE_API_KEY` | Google AI API key for Gemini integration | Yes |

### Database Connections

The tool supports multiple connection types:

#### MySQL/PostgreSQL
```typescript
{
  name: "My Database",
  type: "mysql", // or "postgresql"
  host: "localhost",
  port: 3306,
  database: "my_db",
  username: "user",
  password: "password"
}
```

#### SQLite
```typescript
{
  name: "Local DB",
  type: "sqlite",
  filename: "/path/to/database.db"
}
```

#### MySQL Proxy
```typescript
{
  name: "Proxy DB",
  type: "mysql-proxy",
  host: "https://your-proxy-api.com/db",
  server: "mysql-server-name",
  database: "database_name",
  username: "proxy_user",
  password: "proxy_password"
}
```

## 📚 Usage Guide

### 1. **Database Connection**
- Navigate to the **Connections** tab in the sidebar
- Click **"Add New Connection"**
- Fill in your database details
- Test the connection before saving

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

## 🛠️ Development

### Project Structure

```
src/
├── app/                    # Next.js app router
│   ├── api/               # API routes
│   │   ├── connections/   # Connection testing
│   │   ├── query/         # Query execution
│   │   └── llm/          # AI query generation
│   ├── globals.css        # Global styles
│   ├── layout.tsx         # Root layout
│   └── page.tsx          # Main dashboard
├── components/            # React components
│   ├── ui/               # shadcn/ui components
│   ├── ConnectionManager.tsx
│   ├── DatabaseExplorer.tsx
│   ├── LLMQueryGenerator.tsx
│   ├── QueryEditor.tsx
│   ├── QueryHistory.tsx
│   └── ThemeProvider.tsx
├── lib/                  # Utility libraries
│   ├── database/         # Database connections
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
- **CodeMirror 6** - Advanced code editor
- **Google Generative AI** - AI query generation
- **Database Drivers** - mysql2, pg, better-sqlite3

### Building for Production

```bash
npm run build
npm start
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- **Google AI** for Gemini 2.0 Flash Lite
- **shadcn/ui** for beautiful React components
- **CodeMirror** for the excellent code editor
- **Next.js** team for the amazing framework

## 📞 Support

For support, please open an issue on GitHub or contact the development team.

---

**Built with ❤️ using Next.js and modern web technologies**

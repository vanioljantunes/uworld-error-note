# Obsidian Chat - Local MCP Integration

A Next.js app that lets you chat with your Obsidian vault using the Model Context Protocol (MCP).

## Features

- 🔍 Search your Obsidian vault from a chat interface
- 🤖 AI-powered answers using OpenAI GPT
- 🏷️ Optional tag-based filtering
- 📚 Source citations with note snippets
- 🔄 Re-index button for fresh searches
- 💻 Fully local (no cloud sync) - runs on your machine

## Prerequisites

- **Node.js** (v20 or higher)
- **npm** (comes with Node.js)
- **OpenAI API Key** (get from https://platform.openai.com/api-keys)
- **mcp-obsidian** package (will be auto-installed)

## Installation

1. **Clone or navigate to the project directory:**
   ```bash
   cd obsidian-chat
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Create `.env.local` file with your OpenAI key:**
   ```bash
   cp .env.local.example .env.local
   ```
   
   Then edit `.env.local` and add your OpenAI API key:
   ```
   OPENAI_API_KEY=sk-your-actual-key-here
   ```

## Configuration

### Change the Vault Path

Edit `.vscode/mcp.json` to point to your Obsidian vault:

```json
{
  "mcpServers": {
    "obsidian": {
      "command": "npx",
      "args": [
        "mcp-obsidian",
        "C:\\Users\\YourName\\OneDrive\\Documents\\MyVault"
      ]
    }
  }
}
```

Also update the `VAULT_PATH` constant in `src/app/api/chat/route.ts`:

```typescript
const VAULT_PATH = "C:\\Users\\YourName\\OneDrive\\Documents\\MyVault";
```

## Running the App

1. **Start the development server:**
   ```bash
   npm run dev
   ```

2. **Open your browser:**
   ```
   http://localhost:3000
   ```

3. **Start chatting:**
   - Type your question in the chat box
   - Optional: Add a tag filter to search specific notes
   - Click "Re-index" to trigger a fresh search cycle
   - View sources on the right panel

## Architecture

### Frontend
- **Framework:** Next.js (App Router)
- **UI:** Pure CSS with responsive 3-column layout
- **State:** React hooks (useState, useEffect)

### Backend API
- **Route:** `POST /api/chat`
- **Process:**
  1. Search relevant notes using MCP (mcp-obsidian)
  2. Read full content of top 5 results
  3. Send notes + query to OpenAI GPT
  4. Return answer with sources

### MCP Integration
- **Server:** mcp-obsidian (via npx)
- **Transport:** Stdio (command-line process)
- **Tools used:**
  - `search`: Find notes by query + optional tag
  - `read_note`: Get full content of a note

## Project Structure

```
obsidian-chat/
├── src/
│   └── app/
│       ├── api/
│       │   ├── chat/
│       │   │   └── route.ts          # Main chat endpoint
│       │   └── reindex/
│       │       └── route.ts          # Re-index trigger
│       ├── layout.tsx                # Root layout
│       ├── page.tsx                  # Chat UI component
│       ├── page.module.css           # UI styles
│       └── globals.css               # Global styles
├── .vscode/
│   └── mcp.json                      # MCP server config
├── .env.local.example                # Environment template
├── package.json
├── tsconfig.json
├── next.config.js
└── README.md
```

## Troubleshooting

### "OPENAI_API_KEY not configured"
- Make sure you created `.env.local` (from `.env.local.example`)
- Restart the dev server after adding the key

### "mcp-obsidian not found"
- Run `npm install` (should auto-install dependencies)
- Or manually: `npx mcp-obsidian <vault-path>`

### "Vault path not found"
- Check the path in `.vscode/mcp.json` is correct
- Use forward slashes or escaped backslashes: `C:\\Users\\...`
- Ensure the vault folder exists and is readable

### "No relevant notes found"
- Your search term might not match any notes
- Try a simpler, shorter query
- Use the tags filter to narrow scope

## Future Enhancements

- [ ] Persistent note index for faster searches
- [ ] Voice-to-text input
- [ ] Export conversations
- [ ] Multiple vault support
- [ ] Custom system prompts
- [ ] Wikilink navigation

## API Reference

### POST /api/chat
Request:
```json
{
  "message": "your question",
  "tag": "optional-tag-filter"
}
```

Response:
```json
{
  "answer": "AI response based on notes",
  "sources": [
    {
      "title": "Note Title",
      "path": "path/to/note.md",
      "snippet": "relevant excerpt..."
    }
  ]
}
```

### POST /api/reindex
Triggers a fresh search cycle. No body required.

## Development

### Build for production:
```bash
npm run build
npm start
```

### Run linter:
```bash
npm run lint
```

## Notes

- All text searches happen locally via MCP
- OpenAI API calls are made from your computer (no proxy)
- Vault paths with spaces and special characters (accents, etc.) are supported
- Each chat message searches fresh (no persistent cache yet)

## License

MIT

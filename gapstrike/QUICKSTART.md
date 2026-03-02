# Quick Start Guide - Obsidian Chat Local MCP

## ✅ Status: Ready to Use

Your Next.js + MCP + Obsidian Chat app is fully set up and running!

---

## 🚀 Starting the Dev Server

Simply run:

```bash
cd c:\Users\vanio\OneDrive\Área de Trabalho\python\crewAI\obsidian-chat
.\dev.bat
```

Or manually:

```bash
npm run dev
```

The app will start on **http://localhost:3000** (or next available port).

---

## 🔑 Configure Your OpenAI API Key

1. Get your API key from: https://platform.openai.com/api-keys

2. Edit `.env.local`:

```
# Get your OpenAI API Key from: https://platform.openai.com/api-keys
OPENAI_API_KEY=sk-your-actual-key-here
```

Replace `sk-your-actual-key-here` with your actual key.

---

## 🗂️ Change Your Vault Path

If your Obsidian vault is at a different location, edit two files:

### 1. `.vscode/mcp.json`
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

### 2. `src/app/api/chat/route.ts`
Find this line and update it:
```typescript
const VAULT_PATH = "C:\\Users\\YourName\\OneDrive\\Documents\\MyVault";
```

---

## 💡 How It Works

1. **Type your question** → Chat sends to `/api/chat`
2. **Search notes** → Backend uses MCP to search your vault
3. **Read content** → Reads top 5 matching notes
4. **Ask OpenAI** → Sends notes + question to GPT-4o-mini
5. **Show answer + sources** → Displays response and note citations

---

## 🛠️ Project Structure

```
obsidian-chat/
├── src/
│   └── app/
│       ├── api/
│       │   ├── chat/route.ts      ← Main AI chat endpoint
│       │   └── reindex/route.ts   ← Re-index trigger
│       ├── page.tsx              ← Chat UI
│       └── page.module.css        ← Styles
├── .vscode/mcp.json              ← MCP config
├── .env.local                    ← OpenAI key (you set this)
├── package.json
└── README.md
```

---

## 📋 Building for Production

```bash
npm run build
npm start
```

---

## ⚠️ Troubleshooting

### "OPENAI_API_KEY not configured"
- Did you create `.env.local`?
- Did you restart the dev server after adding the key?

### "mcp-obsidian not found"
- Run: `npm install`
- Make sure Node.js/npm is in your PATH

### "No relevant notes found"
- Search terms might not match your vault
- Try simpler, shorter queries
- Check vault path is correct

### Dev server won't start
- Use `dev.bat` instead of `npm run dev`
- Make sure port 3000 is free (or let it use 3001)

---

## 📝 Notes

✅ App is fully functional and ready to chat
✅ UI: Search filter (left) + Chat (center) + Sources (right)
✅ Supports Windows paths with spaces and accents
✅ Uses gpt-4o-mini for fast, efficient responses
✅ Sources show note title, path, and text snippet
✅ Re-index button triggers fresh search

---

## 🔗 Useful Links

- **Next.js Docs:** https://nextjs.org/docs
- **OpenAI API:** https://platform.openai.com
- **MCP Documentation:** https://modelcontextprotocol.io
- **Your Obsidian Vault:** file:///C:/Users/vanio/OneDrive/Área%20de%20Trabalho/teste_crew/teste

---

Enjoy your local Obsidian chat! 🎉

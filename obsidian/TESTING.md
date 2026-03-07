# Testing & Deployment Guide

## 🧪 Local Testing

### Test 1: Start the Dev Server
```bash
cd c:\Users\vanio\OneDrive\Área de Trabalho\python\crewAI\obsidian-chat
.\dev.bat
```

Expected output:
```
✓ Ready in X.Xs
✓ Compiled / in XXXms
```

### Test 2: Open UI
Visit: http://localhost:3000 (or http://localhost:3001 if 3000 is busy)

Expected: 
- Left sidebar with "Obsidian Chat" title, tag filter input, and Re-index button
- Center chat area with empty state message
- Right sidebar with "Sources" panel (empty initially)

### Test 3: Test Chat (without real MCP)
1. Type a question: "What is in my vault?"
2. Click Send
3. You should see an error about missing OpenAI key OR mcp-obsidian not found

This is expected! The error message will guide you.

### Test 4: Add Your OpenAI Key
1. Edit `.env.local`:
```
OPENAI_API_KEY=sk-your-real-key
```

2. Restart dev server (Ctrl+C, then `.\dev.bat` again)

3. Try the chat again

Expected: If you have `mcp-obsidian` installed and the vault path is correct, you'll get results!

---

## 🚀 Production Build

### Step 1: Build
```bash
npm run build
```

Output should say:
```
✓ Compiled successfully
```

### Step 2: Start Production Server
```bash
npm start
```

The app will run on port 3000 in production mode.

### Step 3: Test
Same as local testing above - should work identically.

---

## 📦 Dependencies

All required packages are already installed:

- **next** - React framework
- **react** - UI library  
- **openai** - OpenAI API client
- **@modelcontextprotocol/sdk** - MCP client SDK
- **dotenv** - Environment variables

Verify with:
```bash
npm list
```

---

## 🔌 MCP Setup

The app expects `mcp-obsidian` to be callable via:

```bash
npx mcp-obsidian "C:\Users\vanio\OneDrive\Área de Trabalho\teste_crew\teste"
```

Install if missing:
```bash
npm install -g mcp-obsidian
```

Test manually:
```bash
npx mcp-obsidian "C:\path\to\vault" --help
```

---

## 🐛 Debug Mode

To see detailed logs:

### Browser Console
1. Open DevTools (F12)
2. Go to Console tab
3. Change the vault URL in `.vscode/mcp.json` to see MCP logs

### Server Logs
Check terminal where `npm run dev` or `npm start` is running for errors.

---

## 📊 API Response Format

### POST `/api/chat`
Request:
```json
{
  "message": "What's in your vault?",
  "tag": "optional-tag"
}
```

Response:
```json
{
  "answer": "Based on your notes...",
  "sources": [
    {
      "title": "Note Title",
      "path": "folder/note.md",
      "snippet": "Text excerpt from note..."
    }
  ]
}
```

---

## ✅ Checklist Before Going Live

- [ ] `.env.local` has valid OPENAI_API_KEY
- [ ] `.vscode/mcp.json` has correct vault path
- [ ] `src/app/api/chat/route.ts` has correct VAULT_PATH constant
- [ ] `npm run build` completes without errors
- [ ] `npm start` runs and server responds to requests
- [ ] Chat UI loads and looks correct
- [ ] Questions get responses (or expected errors)
- [ ] Sources panel shows results

---

## 🔄 Rebuilding After Changes

**Changes to `.env.local`:**
- Restart: `npm run dev` or `npm start`

**Changes to `.vscode/mcp.json`:**
- Restart: `npm run dev` (client auto-reloads)

**Changes to `src/app/api/chat/route.ts`:**
- Auto-reload: Dev server watches files

**Changes to `src/app/page.tsx` or CSS:**
- Auto-reload: Hot Module Replacement (HMR)

---

## 🆘 Common Issues & Fixes

| Issue | Solution |
|-------|----------|
| Port 3000 busy | Let it use 3001 automatically |
| `mcp-obsidian` not found | `npm install -g mcp-obsidian` |
| OPENAI_API_KEY error | Add key to `.env.local`, restart server |
| No search results | Check vault path, try simpler query |
| UI not loading | Clear `.next` folder: `rm -r .next` then restart |
| TypeScript errors | Run `npm run build` to see full errors |

---

## 📈 Performance Tips

- **Faster responses**: Use shorter search terms
- **Reduce lag**: Keep vault under 10K notes for best performance  
- **Lower costs**: mcp-obsidian searches locally (free), only OpenAI calls cost money
- **Cache notes**: Future version could cache frequently accessed notes

---

## 🔐 Security Notes

- **Vault is local-only**: Never synced to cloud
- **OpenAI key**: Keep `.env.local` secure, never commit to git
- **MCP runs locally**: No remote connections (except OpenAI API)
- **No database**: Everything is stateless (great for privacy!)

---

Happy testing! 🚀

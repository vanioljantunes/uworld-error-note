# GapStrike

USMLE study tool — extract questions, generate flowcharts, create Anki cards, and chat with your notes.

## Project Structure

```
GapStrike/
  saas-shell/           Next.js web app (Vercel, Supabase auth)
  usmle_error_note/     Python FastAPI + CrewAI backend
  extension/            Chrome extension (UWorld capture)
  templates/anki/       Anki card templates
  docs/                 Planning docs + design system reference
  .planning/            GSD project planning
```

## Getting Started

### Frontend (saas-shell)

```bash
cd saas-shell
cp .env.local.example .env.local   # fill in keys
npm install
npm run dev
```

### Backend (usmle_error_note)

```bash
cd usmle_error_note
pip install -r requirements.txt
python server.py
```

### Tests

```bash
cd saas-shell
npm test
```

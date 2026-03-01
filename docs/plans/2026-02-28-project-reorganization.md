# Project Reorganization Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Rename folders and inline helper scripts so the project root is clean and self-explanatory.

**Architecture:** Move `obsidian-chat/` → `frontend/`, `usmle_error_note/` → `backend/`, delete the obsolete `obsidian/` folder and duplicate `templates/` inside backend, then inline `_start_backend.bat` and `_start_frontend.bat` into `start_uworld.bat`.

**Tech Stack:** Windows batch scripts, Python (FastAPI/CrewAI), Next.js

---

### Task 1: Delete obsolete folders

**Files:**
- Delete: `obsidian/` (entire directory — old frontend, not referenced anywhere)
- Delete: `usmle_error_note/templates/` (duplicate of root `templates/`)

**Step 1: Delete `obsidian/`**

```bash
rm -rf "c:/Users/vanio/OneDrive/Área de Trabalho/python/crewAI/obsidian"
```

**Step 2: Delete duplicate templates inside backend**

```bash
rm -rf "c:/Users/vanio/OneDrive/Área de Trabalho/python/crewAI/usmle_error_note/templates"
```

**Step 3: Verify only root `templates/` remains**

```bash
find "c:/Users/vanio/OneDrive/Área de Trabalho/python/crewAI" -name "templates" -type d
```
Expected: only `crewAI/templates`

---

### Task 2: Rename `obsidian-chat/` → `frontend/`

**Files:**
- Rename: `obsidian-chat/` → `frontend/`

**Step 1: Move the folder**

```bash
mv "c:/Users/vanio/OneDrive/Área de Trabalho/python/crewAI/obsidian-chat" \
   "c:/Users/vanio/OneDrive/Área de Trabalho/python/crewAI/frontend"
```

**Step 2: Verify**

```bash
ls "c:/Users/vanio/OneDrive/Área de Trabalho/python/crewAI/frontend"
```
Expected: `src/`, `package.json`, `next.config.js`, etc.

---

### Task 3: Rename `usmle_error_note/` → `backend/`

**Files:**
- Rename: `usmle_error_note/` → `backend/`

**Step 1: Move the folder**

```bash
mv "c:/Users/vanio/OneDrive/Área de Trabalho/python/crewAI/usmle_error_note" \
   "c:/Users/vanio/OneDrive/Área de Trabalho/python/crewAI/backend"
```

**Step 2: Verify `crew.py` template path still resolves correctly**

`crew.py` line 28 uses:
```python
os.path.join(os.path.dirname(__file__), "..", "templates")
```
After rename: `backend/crew.py` → `..` → `crewAI/templates/` ✓ No code change needed.

**Step 3: Verify**

```bash
ls "c:/Users/vanio/OneDrive/Área de Trabalho/python/crewAI/backend"
```
Expected: `config/`, `crew.py`, `models.py`, `server.py`, `tools.py`, `requirements.txt`, `.env`

---

### Task 4: Update `start_uworld.bat` with inlined commands

**Files:**
- Modify: `start_uworld.bat`

The current file calls `_start_backend.bat` and `_start_frontend.bat`.
Replace those two `start /b` lines with inlined commands pointing to the new folder names.

**Step 1: Replace the backend start line (line 18)**

Old:
```bat
start /b "" cmd /c "%~dp0_start_backend.bat"
```

New:
```bat
start /b "" cmd /c "cd /d "%~dp0backend" && python server.py"
```

**Step 2: Replace the frontend start line (line 24)**

Old:
```bat
start /b "" cmd /c "%~dp0_start_frontend.bat"
```

New:
```bat
start /b "" cmd /c "set PATH=C:\Program Files\nodejs;%APPDATA%\npm;%PATH% && cd /d "%~dp0frontend" && rmdir /s /q .next 2>nul && npm run dev"
```

**Step 3: Update the comment on line 16**

Old:
```bat
:: Start backend (minimized)
```
New:
```bat
:: Start backend in background
```

**Step 4: Update the comment on line 22**

Old:
```bat
:: Start frontend (minimized)
```
New:
```bat
:: Start frontend in background
```

---

### Task 5: Delete the helper `.bat` files

**Files:**
- Delete: `_start_backend.bat`
- Delete: `_start_frontend.bat`

**Step 1: Delete both files**

```bash
rm "c:/Users/vanio/OneDrive/Área de Trabalho/python/crewAI/_start_backend.bat"
rm "c:/Users/vanio/OneDrive/Área de Trabalho/python/crewAI/_start_frontend.bat"
```

**Step 2: Verify final root structure**

```bash
ls "c:/Users/vanio/OneDrive/Área de Trabalho/python/crewAI"
```
Expected:
```
backend/
docs/
frontend/
images/
templates/
start_uworld.bat
```

---

## Verification

Launch `start_uworld.bat` and confirm:
1. Only ONE terminal window appears in the taskbar
2. Browser opens to `http://localhost:3000` and the app loads
3. The backend API responds at `http://localhost:8000`

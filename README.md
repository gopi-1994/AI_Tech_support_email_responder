# Secure AI Agent for Technical Support

This repository contains the Secure AI Support Agent, featuring a React frontend (`web`) and a FastAPI backend (`server`).

## Project Structure

```text
Project/
├── docs/             # Project documentation and architectural overviews
├── scripts/          # Helper scripts (e.g., parsing docx files)
├── server/           # FastAPI python backend
...
```

## Quick Start

You can start **both** the frontend and backend servers together concurrently using the unified startup script at the root:

```bash
python start.py
```

### Alternatively, Start Manually:
**Server (Backend):**
```bash
cd server
pip install -r requirements.txt
uvicorn main:app --reload
```

**Web (Frontend):**
```bash
cd web
npm install
npm run dev
```

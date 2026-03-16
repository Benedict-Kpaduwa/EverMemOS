# MindMemo 🧠

> **AI-powered mental health companion with persistent memory — built on EverMemOS**

---

## 🏆 Competition Track

**EverMind Memory Genesis Competition 2026 · Track 1: Agent + Memory**

---

## The Problem

### The Therapist Gap
There are fewer than 1 licensed therapist per 500 people in most countries. Waitlists stretch months. People in daily distress have nowhere to turn for low-stakes emotional support.

### AI's Memory Amnesia Problem
Current AI companions reset between sessions — they can't remember what you shared last week, what your triggers are, or what coping strategies worked for you. Every conversation starts from zero, making it feel hollow and transactional.

---

## The Solution

MindMemo is a CBT-based mental health companion that **remembers you**. Powered by EverMemOS, it maintains a persistent, structured memory of your emotional patterns, session history, and identified triggers — across every conversation.

When you return, it knows who you are.

---

## How EverMemOS Memory Is Used

MindMemo makes four types of EverMemOS API calls:

| Operation | Endpoint | Purpose |
|-----------|----------|---------|
| **Store message** | `POST /api/v1/memories` | Every user message is stored as an episodic memory |
| **Store response** | `POST /api/v1/memories` | AI responses are also stored to build conversational context |
| **Retrieve context** | `GET /api/v1/memories/search?query=...` | Semantic search retrieves relevant past memories before each AI call |
| **Session summary** | `POST /api/v1/memories` (tagged `session_summary: true`) | End-of-session summaries are stored with metadata tags |

The retrieved memories are injected into the system prompt, enabling the AI to say *"Last time you mentioned feeling overwhelmed at work…"* naturally.

---

## Privacy-First Design

MindMemo stores **structured memory objects**, not raw conversation logs:

- Each memory is a short, semantically complete string (e.g., `"User said: feeling anxious about an upcoming presentation"`)
- Session summaries are metadata-tagged (`session_summary: true`) rather than dumping full transcripts
- No personally identifiable information is required — only a `user_id` string
- Memory retrieval is query-scoped and limited (5 results max), not a full data dump
- All data stays local — EverMemOS runs on `localhost:1995`

---

## Architecture

```
Browser (React + Vite)
        │
        ▼
MindMemo Backend (FastAPI :8000)
        │
   ┌────┴────┐
   ▼         ▼
EverMemOS   OpenAI API
(:1995)     (GPT-4o-mini)
```

---

## Setup

### Prerequisites
- Python 3.12+, Node.js 18+
- EverMemOS running locally (see root repo README)
- OpenAI API key

### 1. Start EverMemOS

```bash
# From the repo root
docker compose up -d
uv run python src/run.py
```

EverMemOS will be available at `http://localhost:1995`.

### 2. Start the MindMemo Backend

```bash
cd mindmemo/backend

# Install dependencies
pip install -r requirements.txt

# Configure environment
cp .env.example .env
# Edit .env and add your OPENAI_API_KEY

# Run the server
uvicorn main:app --reload --port 8000
```

Backend will be available at `http://localhost:8000`.

### 3. Start the MindMemo Frontend

```bash
cd mindmemo/frontend

# Install dependencies
npm install

# Run the dev server
npm run dev
```

Frontend will be available at `http://localhost:5173`.

---

## API Reference (Backend)

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/chat` | Send a message, get an AI response (stores + retrieves EverMemOS memory) |
| `GET`  | `/memory/{user_id}` | Get structured memory profile for a user |
| `POST` | `/session/end` | Write a session summary to EverMemOS |
| `GET`  | `/health` | Health check |

---

## UI Overview

```
┌─────────────────┬──────────────────────────────────────┐
│  Your Memory    │  MindMemo                            │
│                 │                                      │
│  😊 Good (8/10) │  🧠 Hi there! I'm MindMemo…         │
│                 │                                      │
│  Sessions: 3   │  [chat history]                      │
│  Last: today   │                                      │
│                 │                                      │
│  Triggers:      │                                      │
│  • work         │  ┌──────────────────────────────┐   │
│  • sleep        │  │ Share what's on your mind…  │   │
│  • anxious      │  └──────────────────────────────┘   │
└─────────────────┴──────────────────────────────────────┘
```

---

## CBT Techniques Used

The AI companion draws from:
- **Cognitive Restructuring** — challenging negative thought patterns
- **Behavioral Activation** — scheduling positive activities
- **Grounding Techniques** — 5-4-3-2-1 sensory anchoring
- **Thought Journaling** — externalizing and examining thoughts
- **Sleep Hygiene Prompts** — when sleep-related triggers are detected

Technique suggestions are personalized based on retrieved memories.

---

## Disclaimer

MindMemo is not a medical device or licensed therapy service. It is an AI companion for emotional support and psychoeducation. For crises or clinical concerns, please contact a licensed mental health professional or crisis line.

---

## License

Apache 2.0 — Same as EverMemOS.

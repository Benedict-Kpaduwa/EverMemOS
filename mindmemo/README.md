# MindMemo 🧠

> **AI-Powered Mental Health Companion with Continuous Persistent Memory**  
> Built on [EverMemOS](https://github.com/evermemos) — the enterprise-grade long-term memory system for AI.

[![EverMemOS](https://img.shields.io/badge/Powered%20by-EverMemOS-10b981?style=flat-square)](https://github.com/evermemos)
[![FastAPI](https://img.shields.io/badge/Backend-FastAPI-009688?style=flat-square)](https://fastapi.tiangolo.com/)
[![React](https://img.shields.io/badge/Frontend-React%20%2B%20Vite-61dafb?style=flat-square)](https://react.dev/)
[![License](https://img.shields.io/badge/License-Apache%202.0-blue?style=flat-square)](LICENSE)

---

## 🎯 What Problem Does This Solve?

Every mental health chatbot today suffers from the same flaw: **amnesia**. Each conversation starts from zero. There is no continuity, no relationship, no compounding understanding of the user.

MindMemo is different. It uses **EverMemOS** to build a genuine, persistent model of who you are across every session — your triggers, your mood patterns, your recurring themes. Like a real therapist who remembers you.

---

## ✨ Key Features

| Feature | Description |
|---|---|
| 🧠 **Persistent Memory** | Every conversation is stored and indexed in EverMemOS — mood, triggers, insights |
| 🔍 **Hybrid Search** | Retrieves relevant past memories using both BM25 keyword + vector semantic search |
| 💬 **"I Remember You Said…"** | UI explicitly cites which memories were used to generate each response |
| 📊 **Live Memory Panel** | Real-time sidebar shows mood arc, recurring themes, session count, AI profile summary |
| 🌿 **CBT-Grounded AI** | System prompt guides responses with Cognitive Behavioral Therapy best practices |
| 🔒 **Local Data Enclave** | All memories stored in your self-hosted EverMemOS instance — nothing leaves your stack |

---

## 🏗 Architecture

```
┌───────────────────────────────────────────┐
│              React Frontend               │
│  ChatWindow │ MemoryPanel │ ChatBubble    │
│         (Vite + Tailwind CSS)             │
└────────────────────┬──────────────────────┘
                     │  HTTP
┌────────────────────▼──────────────────────┐
│           MindMemo FastAPI Backend        │
│  /chat  │  /insights/{user_id}  │ /health │
│   • Hybrid memory search                  │
│   • OpenRouter (GPT-4o-mini)              │
│   • Mood heuristic scoring                │
└────────────────────┬──────────────────────┘
                     │  HTTP
┌────────────────────▼──────────────────────┐
│             EverMemOS (Port 1995)         │
│   POST /api/v1/memories  (store)          │
│   GET  /api/v1/memories  (fetch)          │
│   GET  /api/v1/memories/search (hybrid)   │
│                                           │
│   MongoDB │ Milvus │ Elasticsearch │ Redis │
└───────────────────────────────────────────┘
```

---

## 🚀 Quick Start

### Prerequisites

- Python 3.12+ with `uv`
- Node.js 18+ with `pnpm`
- Running [EverMemOS](../../README.md) instance (port 1995)
- OpenRouter API key (or OpenAI)

### 1. Start EverMemOS

```bash
# From repo root
cp env.template .env   # Fill in OPENAI_API_KEY, MONGODB_URI, etc.
docker-compose up -d   # MongoDB, Milvus, Elasticsearch, Redis
uv run python src/run.py
```

### 2. Start MindMemo Backend

```bash
cd mindmemo/backend
cp .env.example .env   # Add OPENAI_API_KEY and OPENROUTER_BASE_URL
uv run uvicorn main:app --reload --port 8000
```

### 3. Start MindMemo Frontend

```bash
cd mindmemo/frontend
pnpm install
pnpm dev
# Open http://localhost:5173
```

---

## 🔌 How EverMemOS Integration Works

### Storing a Message
Every user message and AI response is sent to EverMemOS:
```json
POST /api/v1/memories
{
  "message_id": "uuid",
  "sender": "user_001",
  "content": "I've been feeling overwhelmed at work",
  "role": "user",
  "create_time": "2026-03-16T..."
}
```
EverMemOS automatically extracts **episodic memories** and **user profile** from accumulated messages.

### Hybrid Memory Retrieval
Before every AI response, we search for relevant past memories:
```
GET /api/v1/memories/search?user_id=user_001&query=<message>&retrieve_method=hybrid&top_k=6
```
- **Keyword (BM25)**: Finds exact topic matches ("work stress mentioned 3 sessions ago")
- **Vector (Milvus)**: Finds semantically similar memories ("feeling overwhelmed" → past anxiety discussions)
- Falls back to keyword-only if vector store is unavailable

### Profile & Insights
```
GET /api/v1/memories?user_id=user_001&memory_type=profile
GET /api/v1/memories?user_id=user_001&memory_type=episodic_memory
```
These are merged to build the live **Memory Panel** sidebar.

---

## 📁 Project Structure

```
mindmemo/
├── backend/
│   ├── main.py          # FastAPI app — chat, insights, session endpoints
│   ├── requirements.txt
│   └── .env.example
└── frontend/
    ├── src/
    │   ├── App.tsx              # Root layout, memory data fetching
    │   ├── components/
    │   │   ├── ChatWindow.tsx   # Chat UI + memory recall cards
    │   │   ├── ChatBubble.tsx   # Message bubbles
    │   │   └── MemoryPanel.tsx  # Live memory sidebar
    │   └── index.css            # Tailwind + custom glassmorphism tokens
    ├── tailwind.config.js
    └── vite.config.js
```

---

## 🧠 Why EverMemOS?

Most memory solutions for AI are either:
- **In-context**: Limited by token windows, lost after session
- **Simple key-value stores**: No semantic search, no structure

EverMemOS provides:
- **Automated memory extraction**: Episodic, profile, foresight, event logs
- **Hybrid retrieval**: BM25 + vector simultaneously
- **Structured memory types**: Distinguishes *what happened* from *who the user is*
- **Enterprise-grade persistence**: MongoDB + Milvus + Elasticsearch

This is not a toy integration — MindMemo uses EverMemOS the way it was designed: as the actual long-term brain of the AI.

---

## 📄 License

Apache 2.0 — see [LICENSE](../../LICENSE)

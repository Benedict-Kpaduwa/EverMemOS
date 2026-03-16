import os
import uuid
from datetime import datetime, timezone

import httpx
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from openai import AsyncOpenAI
from pydantic import BaseModel

load_dotenv()

OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "")
EVERMEMOS_URL = os.getenv("EVERMEMOS_URL", "http://localhost:1995")
OPENROUTER_BASE_URL = os.getenv("OPENROUTER_BASE_URL", "https://openrouter.ai/api/v1")

app = FastAPI(title="MindMemo Backend", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origin_regex=r"http://(localhost|127\.0\.0\.1)(:\d+)?",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

openai_client = AsyncOpenAI(
    api_key=OPENAI_API_KEY,
    base_url=OPENROUTER_BASE_URL,
)


# ─── Schemas ─────────────────────────────────────────────────────────────────


class ChatRequest(BaseModel):
    user_id: str
    message: str


class ChatResponse(BaseModel):
    response: str
    memory_saved: bool


class SessionEndRequest(BaseModel):
    user_id: str
    summary: str


class MemoryProfile(BaseModel):
    triggers: list[str]
    mood_history: list[dict]
    session_count: int
    last_session: str


# ─── EverMemOS Helpers ────────────────────────────────────────────────────────


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _make_message_payload(sender: str, content: str, role: str = "user") -> dict:
    """Build the EverMemOS MemorizeMessageRequest payload."""
    return {
        "message_id": str(uuid.uuid4()),
        "create_time": _now_iso(),
        "sender": sender,
        "sender_name": sender,
        "role": role,  # "user" or "assistant"
        "content": content,
        # group_id omitted → single-user mode, auto-generated from sender
    }


async def _store_message(sender: str, content: str, role: str = "user") -> bool:
    """POST a message to EverMemOS /api/v1/memories."""
    payload = _make_message_payload(sender, content, role)
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.post(
                f"{EVERMEMOS_URL}/api/v1/memories",
                json=payload,
            )
            return resp.status_code in (200, 201, 202)
    except Exception:
        return False


async def _search_memories(user_id: str, query: str, top_k: int = 5) -> list[dict]:
    """GET /api/v1/memories/search → extract text snippets from grouped results."""
    params = {
        "user_id": user_id,
        "query": query,
        "retrieve_method": "keyword",
        "top_k": top_k,
    }
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.get(
                f"{EVERMEMOS_URL}/api/v1/memories/search",
                params=params,
            )
            if resp.status_code == 200:
                data = resp.json()
                groups: list = data.get("result", {}).get("memories", [])
                # groups is a list of dicts: [{episodic_memory: [...]}, ...]
                snippets = []
                for group in groups:
                    for mem_list in group.values():
                        for mem in mem_list:
                            c = mem.get("content") or mem.get("summary") or ""
                            if c:
                                snippets.append({"content": c})
                return snippets
    except Exception:
        pass
    return []


async def _fetch_all_memories(user_id: str, limit: int = 50) -> list[dict]:
    """GET /api/v1/memories → flat list of episodic memory objects."""
    params = {
        "user_id": user_id,
        "memory_type": "episodic_memory",
        "limit": limit,
    }
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.get(
                f"{EVERMEMOS_URL}/api/v1/memories",
                params=params,
            )
            if resp.status_code == 200:
                data = resp.json()
                return data.get("result", {}).get("memories", [])
    except Exception:
        pass
    return []


# ─── Memory Profile Builder ───────────────────────────────────────────────────

TRIGGER_KEYWORDS = [
    "stressed", "anxious", "worried", "overwhelmed", "panic",
    "sad", "depressed", "lonely", "hopeless", "angry", "frustrated",
    "work", "relationship", "sleep", "family",
]


def _build_memory_profile(memories: list[dict]) -> MemoryProfile:
    triggers: list[str] = []
    mood_history: list[dict] = []
    session_count = 0
    last_session = "No sessions yet"

    for mem in memories:
        content = mem.get("content") or mem.get("summary") or ""
        created_at = (
            mem.get("created_at")
            or mem.get("timestamp")
            or mem.get("create_time")
            or ""
        )

        # Count session markers
        if "[Session Summary]" in content:
            session_count += 1
            if created_at:
                last_session = created_at

        # Extract mood scores stored in metadata (if any)
        meta = mem.get("metadata") or {}
        if "mood_score" in meta:
            mood_history.append(
                {
                    "score": meta["mood_score"],
                    "timestamp": created_at,
                    "label": meta.get("mood_label", ""),
                }
            )

        # Trigger keyword extraction
        lower = content.lower()
        for kw in TRIGGER_KEYWORDS:
            if kw in lower and kw not in triggers:
                triggers.append(kw)

    # Fallback last_session
    if memories and last_session == "No sessions yet":
        ts = (
            memories[0].get("created_at")
            or memories[0].get("timestamp")
            or ""
        )
        if ts:
            last_session = ts

    return MemoryProfile(
        triggers=triggers[:10],
        mood_history=mood_history[-20:],
        session_count=session_count,
        last_session=last_session,
    )


# ─── Routes ──────────────────────────────────────────────────────────────────


@app.post("/chat", response_model=ChatResponse)
async def chat(req: ChatRequest):
    """
    1. Search EverMemOS for relevant past memories (keyword retrieval).
    2. Store the user's message in EverMemOS.
    3. Call OpenAI/OpenRouter with CBT system prompt + memory context.
    4. Store AI response in EverMemOS.
    5. Return AI response.
    """
    if not OPENAI_API_KEY:
        raise HTTPException(status_code=500, detail="OPENAI_API_KEY not configured.")

    # 1️⃣  Retrieve relevant memories
    relevant_memories = await _search_memories(req.user_id, req.message)
    memory_text = ""
    if relevant_memories:
        snippets = [m.get("content", "") for m in relevant_memories if m.get("content")]
        memory_text = "\n".join(f"- {s}" for s in snippets[:5])

    # 2️⃣  Store user message
    memory_saved = await _store_message(req.user_id, req.message, role="user")

    # 3️⃣  Build system prompt
    system_prompt = (
        "You are MindMemo, a warm CBT-based mental health companion. "
        f"You have access to this user's memory:\n{memory_text or 'No prior memories yet.'}\n\n"
        "Reference past sessions naturally when relevant (e.g. 'Last time you mentioned...'). "
        "After a few exchanges, suggest a relevant CBT technique based on what you know about this user. "
        "Track mood implicitly. Never diagnose. Always recommend professional help for crises. "
        "Respond with empathy, warmth, and brevity."
    )

    # 4️⃣  Call OpenRouter / OpenAI
    try:
        completion = await openai_client.chat.completions.create(
            model="openai/gpt-4o-mini",
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": req.message},
            ],
            max_tokens=512,
            temperature=0.75,
        )
        ai_response = completion.choices[0].message.content or ""
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"LLM error: {str(e)}")

    # 5️⃣  Store AI response
    await _store_message(req.user_id, ai_response[:400], role="assistant")

    return ChatResponse(response=ai_response, memory_saved=memory_saved)


@app.get("/memory/{user_id}", response_model=MemoryProfile)
async def get_memory(user_id: str):
    """Return a structured memory profile for the UI sidebar."""
    memories = await _fetch_all_memories(user_id)
    return _build_memory_profile(memories)


@app.post("/session/end")
async def end_session(req: SessionEndRequest):
    """Write a session summary to EverMemOS."""
    content = f"[Session Summary] {req.summary}"
    saved = await _store_message(req.user_id, content, role="user")
    return {"saved": saved, "message": "Session summary stored in EverMemOS."}


@app.get("/health")
async def health():
    return {"status": "ok", "service": "MindMemo Backend"}

import os
import re
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

app = FastAPI(title="MindMemo Backend", version="2.0.0")

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


# ─── Schemas ──────────────────────────────────────────────────────────────────


class TurnMessage(BaseModel):
    role: str  # "user" | "assistant"
    content: str


class ChatRequest(BaseModel):
    user_id: str
    message: str
    # Frontend sends full conversation history for accurate in-session context
    conversation_history: list[TurnMessage] = []


class ChatResponse(BaseModel):
    response: str
    memory_saved: bool
    recalled_memories: list[str] = []


class SessionEndRequest(BaseModel):
    user_id: str
    summary: str


class MemoryProfile(BaseModel):
    triggers: list[str]
    mood_history: list[dict]
    session_count: int
    last_session: str
    profile_summary: str = ""


# ─── Mood Heuristics ──────────────────────────────────────────────────────────

POSITIVE_WORDS = {
    "happy", "great", "good", "better", "calm", "relaxed", "hopeful",
    "grateful", "excited", "motivated", "proud", "loved", "confident", "joy",
    "peaceful", "wonderful", "amazing", "fantastic", "energized", "positive",
}
NEGATIVE_WORDS = {
    "anxious", "stressed", "overwhelmed", "sad", "depressed", "lonely",
    "hopeless", "angry", "frustrated", "upset", "tired", "exhausted", "fear",
    "worried", "panic", "worthless", "miserable", "helpless", "scared", "hurt",
}


def _score_mood(text: str) -> float | None:
    """
    Simple keyword-based mood score  0.0 – 10.0.
    Returns None if no clear signal found.
    """
    lower = text.lower()
    words = set(re.findall(r"\b\w+\b", lower))
    pos_hits = len(words & POSITIVE_WORDS)
    neg_hits = len(words & NEGATIVE_WORDS)
    if pos_hits == 0 and neg_hits == 0:
        return None
    total = pos_hits + neg_hits
    score = (pos_hits / total) * 10
    return round(score, 1)


# ─── Trigger Keywords ─────────────────────────────────────────────────────────

TRIGGER_KEYWORDS = [
    "stressed", "anxious", "worried", "overwhelmed", "panic",
    "sad", "depressed", "lonely", "hopeless", "angry", "frustrated",
    "work", "relationship", "sleep", "family", "money", "health",
]


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
        "role": role,
        "content": content,
    }


async def _store_message(sender: str, content: str, role: str = "user") -> bool:
    """POST a message to EverMemOS /api/v1/memories."""
    payload = _make_message_payload(sender, content, role)
    try:
        async with httpx.AsyncClient(timeout=12.0) as client:
            resp = await client.post(
                f"{EVERMEMOS_URL}/api/v1/memories",
                json=payload,
            )
            return resp.status_code in (200, 201, 202)
    except Exception:
        return False


async def _search_memories(user_id: str, query: str, top_k: int = 6) -> list[dict]:
    """
    Hybrid search: keyword + vector fusion via EverMemOS.
    Falls back to keyword-only if hybrid fails (e.g. vector store not running).
    """
    for method in ("hybrid", "keyword"):
        params = {
            "user_id": user_id,
            "query": query,
            "retrieve_method": method,
            "top_k": top_k,
        }
        try:
            async with httpx.AsyncClient(timeout=12.0) as client:
                resp = await client.get(
                    f"{EVERMEMOS_URL}/api/v1/memories/search",
                    params=params,
                )
                if resp.status_code == 200:
                    data = resp.json()
                    groups: list = data.get("result", {}).get("memories", [])
                    snippets = []
                    for group in groups:
                        for mem_list in group.values():
                            for mem in mem_list:
                                c = mem.get("content") or mem.get("summary") or ""
                                if c:
                                    snippets.append({"content": c})
                    if snippets:
                        return snippets
        except Exception:
            pass
    return []


async def _fetch_memories_by_type(user_id: str, memory_type: str, limit: int = 30) -> list[dict]:
    """GET /api/v1/memories for a specific memory_type."""
    params = {
        "user_id": user_id,
        "memory_type": memory_type,
        "limit": limit,
    }
    try:
        async with httpx.AsyncClient(timeout=12.0) as client:
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


def _build_memory_profile(
    episodic: list[dict],
    profiles: list[dict],
) -> MemoryProfile:
    triggers: list[str] = []
    mood_history: list[dict] = []
    session_count = 0
    last_session = "No sessions yet"

    # ── Episodic memories ────
    for mem in episodic:
        content = mem.get("content") or mem.get("summary") or ""
        created_at = (
            mem.get("created_at")
            or mem.get("timestamp")
            or mem.get("create_time")
            or ""
        )

        if "[Session Summary]" in content:
            session_count += 1
            if created_at:
                last_session = created_at

        # Mood from metadata
        meta = mem.get("metadata") or {}
        if "mood_score" in meta:
            mood_history.append({
                "score": meta["mood_score"],
                "timestamp": created_at,
                "label": meta.get("mood_label", ""),
            })
        else:
            # Heuristic mood scoring from content
            score = _score_mood(content)
            if score is not None and created_at:
                mood_history.append({
                    "score": score,
                    "timestamp": created_at,
                })

        # Trigger extraction
        lower = content.lower()
        for kw in TRIGGER_KEYWORDS:
            if kw in lower and kw not in triggers:
                triggers.append(kw)

    # Fallback last_session
    if episodic and last_session == "No sessions yet":
        ts = (
            episodic[0].get("created_at")
            or episodic[0].get("timestamp")
            or ""
        )
        if ts:
            last_session = ts

    # ── Profile memories: extract summary sentence ────
    profile_summary = ""
    for p in profiles[:3]:
        text = p.get("content") or p.get("summary") or ""
        if text and len(text) > 20:
            profile_summary = text[:200]
            break

    return MemoryProfile(
        triggers=triggers[:10],
        mood_history=sorted(mood_history, key=lambda x: x.get("timestamp", ""))[-20:],
        session_count=session_count,
        last_session=last_session,
        profile_summary=profile_summary,
    )


# ─── Routes ──────────────────────────────────────────────────────────────────


@app.post("/chat", response_model=ChatResponse)
async def chat(req: ChatRequest):
    """
    1. Hybrid search EverMemOS for relevant past memories (cross-session context).
    2. Build full multi-turn message list from the frontend conversation_history.
    3. Store the user's message in EverMemOS.
    4. Call OpenAI/OpenRouter with system prompt + past memories + full session history.
    5. Store AI response in EverMemOS.
    6. Return AI response + recalled memory snippets for UI.
    """
    if not OPENAI_API_KEY:
        raise HTTPException(status_code=500, detail="OPENAI_API_KEY not configured.")

    # 1️⃣  Hybrid-search EverMemOS for cross-session memories
    relevant_memories = await _search_memories(req.user_id, req.message)
    memory_text = ""
    recalled_snippets: list[str] = []
    if relevant_memories:
        snippets = [m.get("content", "") for m in relevant_memories if m.get("content")]
        recalled_snippets = snippets[:3]
        memory_text = "\n".join(f"- {s}" for s in snippets[:5])

    # 2️⃣  Store user message in EverMemOS (async, non-blocking for UX)
    memory_saved = await _store_message(req.user_id, req.message, role="user")

    # 3️⃣  Build system prompt (cross-session memory context)
    system_prompt = (
        "You are MindMemo, a warm, empathetic CBT-based mental health companion with "
        "persistent memory. You remember everything the user has told you — both in "
        "this conversation and in previous sessions.\n\n"
        "Cross-session memories from EverMemOS:\n"
        f"{memory_text or 'No prior cross-session memories yet.'}\n\n"
        "Core instructions:\n"
        "- The current conversation history is included in the messages below — you have "
        "full access to everything said in this session. NEVER say you don't remember "
        "something the user told you earlier in this conversation.\n"
        "- Reference relevant past context naturally: 'You mentioned feeling overwhelmed earlier…'\n"
        "- After 2-3 exchanges, suggest a targeted CBT technique.\n"
        "- Never diagnose. Recommend professional help for crises.\n"
        "- Respond with warmth, brevity, and genuine curiosity.\n"
        "- Keep responses under 150 words unless a technique is requested."
    )

    # 4️⃣  Build full multi-turn message list (in-session history + current message)
    # conversation_history comes from the frontend and includes ALL prior turns
    messages: list[dict] = [{"role": "system", "content": system_prompt}]

    # Add prior turns from this session (exclude the very last user message,
    # which we'll append separately as req.message)
    prior_turns = req.conversation_history
    # conversation_history already includes the current user message at the end
    # sent from the frontend, so we use it directly
    for turn in prior_turns:
        if turn.role in ("user", "assistant"):
            messages.append({"role": turn.role, "content": turn.content})

    # If history is empty or last message was not the current one, append it
    if not prior_turns or prior_turns[-1].content != req.message:
        messages.append({"role": "user", "content": req.message})

    # 5️⃣  Call OpenRouter / OpenAI with full conversation context
    try:
        completion = await openai_client.chat.completions.create(
            model="openai/gpt-4o-mini",
            messages=messages,
            max_tokens=512,
            temperature=0.75,
        )
        ai_response = completion.choices[0].message.content or ""
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"LLM error: {str(e)}")

    # 6️⃣  Store AI response in EverMemOS
    await _store_message(req.user_id, ai_response[:400], role="assistant")

    return ChatResponse(
        response=ai_response,
        memory_saved=memory_saved,
        recalled_memories=recalled_snippets,
    )


@app.get("/insights/{user_id}", response_model=MemoryProfile)
async def get_insights(user_id: str):
    """
    Return a rich structured memory profile by fetching both
    episodic memories AND user profile memories from EverMemOS in parallel.
    """
    import asyncio
    episodic, profiles = await asyncio.gather(
        _fetch_memories_by_type(user_id, "episodic_memory", limit=50),
        _fetch_memories_by_type(user_id, "profile", limit=10),
    )
    return _build_memory_profile(episodic, profiles)


# Keep legacy /memory/{user_id} for backwards-compatibility
@app.get("/memory/{user_id}", response_model=MemoryProfile)
async def get_memory(user_id: str):
    """Legacy endpoint — wraps /insights/{user_id}."""
    return await get_insights(user_id)


@app.post("/session/end")
async def end_session(req: SessionEndRequest):
    """Write a session summary to EverMemOS."""
    content = f"[Session Summary] {req.summary}"
    saved = await _store_message(req.user_id, content, role="user")
    return {"saved": saved, "message": "Session summary stored in EverMemOS."}


@app.get("/health")
async def health():
    return {"status": "ok", "service": "MindMemo Backend", "version": "2.0.0"}

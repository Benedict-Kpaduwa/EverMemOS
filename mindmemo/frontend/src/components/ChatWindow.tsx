import { useState, useRef, useEffect } from "react";
import ChatBubble from "./ChatBubble";

const BACKEND_URL = "http://localhost:8000";
const USER_ID = "user_001";

interface Message {
  role: "user" | "assistant";
  content: string;
  recalled_memories?: string[];
}
interface ChatWindowProps { onMessageSent?: () => void; }

const SUGGESTED_PROMPTS = [
  { icon: "🍃", text: "I'm feeling overwhelmed today." },
  { icon: "🌙", text: "I can't seem to fall asleep." },
  { icon: "💭", text: "I'd like to try a grounding exercise." },
  { icon: "💼", text: "Work stress is getting to me." },
];

export default function ChatWindow({ onMessageSent }: ChatWindowProps) {
  const [messages, setMessages] = useState<Message[]>([{
    role: "assistant",
    content: "Hi there. I'm MindMemo.\n\nI'm fundamentally different from other AI: I have continuous memory of our sessions, meaning we can build genuine context over time. How are you holding up today?",
  }]);

  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [savingMemory, setSavingMemory] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(true);
  
  // Voice Input (STT) State
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef<any>(null);

  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  
  // Initialize Speech Recognition
  useEffect(() => {
    if (typeof window !== "undefined") {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (SpeechRecognition) {
        recognitionRef.current = new SpeechRecognition();
        recognitionRef.current.continuous = true;
        recognitionRef.current.interimResults = true;
        recognitionRef.current.lang = "en-US";

        recognitionRef.current.onresult = (event: any) => {
          let currentTranscript = "";
          for (let i = event.resultIndex; i < event.results.length; i++) {
             currentTranscript += event.results[i][0].transcript;
          }
          setInput((prev) => prev ? prev + " " + currentTranscript.trim() : currentTranscript.trim());
          autoResize();
        };

        recognitionRef.current.onerror = (event: any) => {
          console.error("Speech recognition error", event.error);
          setIsListening(false);
        };

        recognitionRef.current.onend = () => {
          setIsListening(false);
        };
      }
    }
  }, []);

  const toggleListening = () => {
    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
    } else {
      if (recognitionRef.current) {
        setInput(""); // Optional: clear input before starting to listen
        recognitionRef.current.start();
        setIsListening(true);
      } else {
        alert("Your browser does not support Speech Recognition.");
      }
    }
  };

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, sending]);

  const autoResize = () => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 140) + "px";
  };

  const sendMessage = async (text?: string) => {
    const msg = (text ?? input).trim();
    if (!msg || sending) return;

    setShowSuggestions(false);

    // Build the updated message history INCLUDING the new user message
    const updatedHistory = [
      ...messages.filter((m) => m.role === "user" || m.role === "assistant"),
      { role: "user" as const, content: msg },
    ];

    setMessages((prev) => [...prev, { role: "user", content: msg }]);
    setInput("");
    if (textareaRef.current) textareaRef.current.style.height = "auto";

    setSending(true);
    setTimeout(() => setSavingMemory(true), 300);

    try {
      const res = await fetch(`${BACKEND_URL}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: USER_ID,
          message: msg,
          // Send entire conversation history so backend builds multi-turn LLM context
          conversation_history: updatedHistory.map((m) => ({
            role: m.role,
            content: m.content,
          })),
        }),
      });

      setSavingMemory(false);

      if (!res.ok) {
        const err = await res.json().catch(() => ({})) as { detail?: string };
        throw new Error(err?.detail ?? "Request failed");
      }

      const data = await res.json() as { response: string; recalled_memories?: string[] };
      setMessages((prev) => [...prev, {
        role: "assistant",
        content: data.response,
        recalled_memories: data.recalled_memories ?? [],
      }]);
      onMessageSent?.();

    } catch (e) {
      setSavingMemory(false);
      const errMessage = e instanceof Error ? e.message : "Unknown error";
      setMessages((prev) => [...prev, {
        role: "assistant",
        content: `Connection issue: ${errMessage}\n\nPlease ensure the backend is running on port 8000.`,
      }]);
    } finally {
      setSending(false);
      if (window.matchMedia('(pointer: fine)').matches) {
        setTimeout(() => textareaRef.current?.focus(), 100);
      }
    }
  };

  const handleKey = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  };

  const charCount = input.length;

  return (
    <div className="flex flex-col h-full bg-transparent w-full">

      {/* ── Header ── */}
      <header className="flex flex-row items-center justify-between px-4 sm:px-6 py-3.5 sm:py-4 glass-panel border-x-0 border-t-0 flex-shrink-0 z-20">
        <div className="flex items-center gap-3 sm:gap-4 pr-12 md:pr-0">
          <div className="relative flex-shrink-0 w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-br from-emerald-500/20 to-teal-400/10 border border-emerald-500/20 flex flex-col items-center justify-center shadow-lg shadow-emerald-500/5">
            <span className="text-base sm:text-lg leading-none">🧠</span>
            {sending && <span className="absolute -top-1 -right-1 flex h-2.5 w-2.5 sm:h-3 sm:w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 sm:h-3 sm:w-3 bg-emerald-500"></span>
            </span>}
          </div>
          <div className="min-w-0 flex flex-col">
            <h1 className="font-display font-semibold text-base sm:text-lg text-zinc-100 tracking-tight leading-tight truncate">MindMemo</h1>
            <p className="text-[11px] sm:text-xs font-medium text-emerald-400/80 truncate">Continuous Context CBT</p>
          </div>
        </div>

        <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20">
          <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse-glow" />
          <span className="text-[11px] font-semibold tracking-wider text-emerald-400 uppercase leading-none mt-px">System Online</span>
        </div>
      </header>

      {/* ── Messages ── */}
      <div className="flex-1 overflow-y-auto px-3 sm:px-6 lg:px-8 py-5 sm:py-8 flex flex-col scroll-smooth">
        <div className="max-w-3xl mx-auto w-full flex flex-col pb-2">

          {messages.map((msg, i) => (
            <div key={i}>
              {/* ── Memory Recall Card (before assistant bubble) ── */}
              {msg.role === "assistant" && msg.recalled_memories && msg.recalled_memories.length > 0 && (
                <div className="flex justify-start mb-2 px-1 sm:px-0 animate-slide-up">
                  <div className="max-w-[85%] sm:max-w-[75%] ml-[2.375rem] sm:ml-[2.75rem]">
                    <div className="flex items-center gap-1.5 mb-1.5">
                      <div className="h-px flex-1 bg-indigo-500/20" />
                      <span className="text-[9px] sm:text-[10px] font-semibold text-indigo-400/70 uppercase tracking-widest flex items-center gap-1">
                        <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
                        From memory
                      </span>
                      <div className="h-px flex-1 bg-indigo-500/20" />
                    </div>
                    <div className="flex flex-col gap-1">
                      {msg.recalled_memories.slice(0, 2).map((mem, mi) => (
                        <div key={mi}
                          className="text-[11px] sm:text-xs text-indigo-300/80 bg-indigo-500/[0.06] border border-indigo-500/15 rounded-xl px-3 py-1.5 leading-relaxed italic"
                        >
                          "{mem.length > 100 ? mem.slice(0, 100) + "…" : mem}"
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
              <ChatBubble role={msg.role} content={msg.content} />
            </div>
          ))}

          {/* ── Suggested Prompts ── */}
          {showSuggestions && messages.length === 1 && (
            <div className="mt-4 sm:mt-8 animate-slide-up bg-zinc-900/40 p-4 sm:p-5 rounded-2xl border border-white/5 mx-1 sm:mx-0">
              <p className="text-[11px] sm:text-xs font-semibold tracking-widest text-zinc-500 uppercase mb-3 sm:mb-4 text-center">Suggested Topics</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 sm:gap-3">
                {SUGGESTED_PROMPTS.map((p, idx) => (
                  <button key={idx} onClick={() => sendMessage(p.text)}
                    className="flex flex-row md:flex-col items-center md:items-start text-left p-3 sm:p-4 gap-3 md:gap-0 rounded-xl border border-white/5 bg-white/[0.02] hover:bg-white/[0.04] hover:border-emerald-500/30 transition-all duration-300 group"
                  >
                    <span className="text-xl md:mb-2 opacity-80 group-hover:scale-110 transition-transform duration-300 flex-shrink-0">{p.icon}</span>
                    <span className="text-xs sm:text-[13px] font-medium text-zinc-300 group-hover:text-emerald-100 flex-1">{p.text}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* ── Typing Indicator ── */}
          {sending && (
            <div className="flex animate-slide-up justify-start mb-6 px-1 lg:px-0">
              <div className="flex gap-2 sm:gap-3 max-w-[85%] sm:max-w-[75%]">
                <div className="flex-shrink-0 w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-gradient-to-br from-indigo-500/20 to-violet-500/10 border border-indigo-500/30 flex items-center justify-center text-[11px] sm:text-[13px] shadow-sm">🧠</div>
                <div className="glass-card px-4 py-3 sm:px-5 sm:py-4 rounded-2xl rounded-tl-sm w-20 sm:w-24">
                  <div className="flex justify-center gap-1.5 items-center h-full">
                    {[0, 0.15, 0.3].map((d, i) => (
                      <span key={i} className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-bounce" style={{ animationDelay: `${d}s` }} />
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          <div ref={bottomRef} className="h-2 sm:h-4" />
        </div>
      </div>

      {/* ── Input Area ── */}
      <div className="px-3 sm:px-6 lg:px-8 pb-4 pt-1 sm:pb-6 flex-shrink-0 relative z-20">
        <div className="max-w-3xl mx-auto w-full relative">

          {/* Saving toast */}
          <div className={`absolute -top-12 left-0 right-0 flex justify-center transition-all duration-500 pointer-events-none ${savingMemory ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
            <div className="bg-emerald-500/15 backdrop-blur-md border border-emerald-500/30 px-4 py-1.5 rounded-full flex items-center gap-2 shadow-lg shadow-emerald-500/10">
              <svg className="animate-spin h-3.5 w-3.5 text-emerald-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              <span className="text-[11px] font-semibold text-emerald-300 tracking-wide uppercase mt-px">Syncing to EverMemOS</span>
            </div>
          </div>

          <div className="relative group mx-1 sm:mx-0">
            <div className="absolute -inset-1 bg-gradient-to-r from-emerald-500/20 to-indigo-500/20 rounded-2xl sm:rounded-3xl blur-md opacity-30 group-hover:opacity-60 transition duration-500 hidden sm:block" />
            <div className="relative flex items-end gap-2 sm:gap-3 glass-card bg-zinc-900/60 rounded-[20px] sm:rounded-3xl p-1.5 sm:p-2.5 border border-white/10 sm:border-white/5">
              <textarea
                ref={textareaRef}
                rows={1}
                value={input}
                onChange={(e) => { setInput(e.target.value); autoResize(); }}
                onKeyDown={handleKey}
                placeholder="Share what's on your mind..."
                disabled={sending}
                className="flex-1 bg-transparent border-0 pl-3 pr-2 py-2.5 sm:py-3 text-[15px] sm:text-base text-zinc-100 placeholder-zinc-500 resize-none focus:outline-none focus:ring-0 leading-snug sm:leading-relaxed scrollbar-hide"
                style={{ minHeight: "44px", maxHeight: "150px", overflowY: "auto" }}
              />
              <div className="flex items-center gap-2 pr-1 sm:pr-2 pb-1 flex-shrink-0">
                <span className={`text-[10px] sm:text-[11px] font-semibold transition-colors hidden xs:block ${charCount > 400 ? 'text-amber-500' : 'text-zinc-600'}`}>
                  {charCount > 0 ? charCount : ''}
                </span>
                
                {/* Voice Input Button */}
                <button
                  onClick={toggleListening}
                  disabled={sending}
                  title={isListening ? "Stop listening" : "Start Voice Input"}
                  className={`w-9 h-9 sm:w-10 sm:h-10 rounded-full sm:rounded-2xl flex items-center justify-center transition-all duration-300 flex-shrink-0 ${isListening ? 'bg-red-500/20 text-red-400 hover:bg-red-500/30' : 'bg-zinc-800/80 hover:bg-zinc-700 text-zinc-400 hover:text-white'} ${sending ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  {isListening ? (
                    <span className="w-2.5 h-2.5 rounded-sm bg-red-500 animate-pulse" />
                  ) : (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4 sm:w-4.5 sm:h-4.5">
                      <line x1="12" y1="1" x2="12" y2="15"></line>
                      <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"></path>
                      <path d="M19 10v2a7 7 0 0 1-14 0v-2"></path>
                      <line x1="12" y1="19" x2="12" y2="23"></line>
                      <line x1="8" y1="23" x2="16" y2="23"></line>
                    </svg>
                  )}
                </button>

                {/* Send Button */}
                <button
                  onClick={() => sendMessage()}
                  disabled={!input.trim() || sending}
                  className={`w-9 h-9 sm:w-11 sm:h-11 rounded-full sm:rounded-2xl flex items-center justify-center transition-all duration-300 flex-shrink-0 ${input.trim() && !sending ? 'bg-emerald-500 hover:bg-emerald-400 text-white shadow-lg shadow-emerald-500/25 sm:hover:-translate-y-0.5' : 'bg-zinc-800/80 text-zinc-500 cursor-not-allowed'}`}
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4 sm:w-5 sm:h-5">
                    <line x1="22" y1="2" x2="11" y2="13" /><polygon points="22 2 15 22 11 13 2 9 22 2" />
                  </svg>
                </button>
              </div>
            </div>
          </div>

          <div className="flex justify-between items-center mt-2 px-3">
            <p className="text-[9px] sm:text-[10px] font-medium text-zinc-600 hidden xs:block">Enter to send · Shift+Enter to break line</p>
            <p className="text-[9px] sm:text-[10px] uppercase tracking-widest font-semibold text-zinc-700 ml-auto pt-1 sm:pt-0">EverMemOS Core</p>
          </div>
        </div>
      </div>
    </div>
  );
}

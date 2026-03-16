interface ChatBubbleProps {
  role: "user" | "assistant";
  content: string;
}

export default function ChatBubble({ role, content }: ChatBubbleProps) {
  const isUser = role === "user";

  return (
    <div className={`flex w-full animate-slide-up ${isUser ? "justify-end" : "justify-start"} mb-4 sm:mb-6 px-1 sm:px-0`}>
      <div className={`flex gap-2.5 sm:gap-3 max-w-[92%] sm:max-w-[85%] md:max-w-[75%] lg:max-w-[65%] ${isUser ? "flex-row-reverse" : "flex-row"}`}>
        
        {/* ── Avatar ── */}
        <div className={`
          flex-shrink-0 w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center text-[11px] sm:text-[13px] shadow-sm
          ${isUser
            ? "bg-gradient-to-br from-emerald-400/20 to-teal-500/10 border border-emerald-500/30 text-emerald-300"
            : "bg-gradient-to-br from-indigo-500/20 to-violet-500/10 border border-indigo-500/30 text-indigo-300"
          }
        `}>
          {isUser ? "👤" : "🧠"}
        </div>

        {/* ── Bubble Content ── */}
        <div className={`
          relative px-4 py-3 sm:px-5 sm:py-3.5 text-[14px] sm:text-[0.95rem] leading-[1.5] sm:leading-[1.6] tracking-wide shadow-sm
          ${isUser
            ? "bg-zinc-800/80 text-zinc-100 rounded-2xl sm:rounded-[20px] rounded-tr-[4px] sm:rounded-tr-sm border border-white/5 backdrop-blur-md"
            : "glass-card text-zinc-200 rounded-2xl sm:rounded-[20px] rounded-tl-[4px] sm:rounded-tl-sm"
          }
        `}>
          <div className="whitespace-pre-wrap word-break-words break-words">
            {content}
          </div>
          
          {/* Subtle glow / inner highlight */}
          {isUser ? (
            <div className="absolute inset-0 rounded-2xl sm:rounded-[20px] rounded-tr-[4px] sm:rounded-tr-sm pointer-events-none rounded-inherit"
                 style={{ boxShadow: "inset 0 1px 1px rgba(255,255,255,0.05)" }} />
          ) : (
             <div className="absolute inset-0 rounded-2xl sm:rounded-[20px] rounded-tl-[4px] sm:rounded-tl-sm pointer-events-none rounded-inherit mix-blend-overlay opacity-30 bg-gradient-to-b from-white to-transparent opacity-[0.02]" />
          )}
        </div>
      </div>
    </div>
  );
}

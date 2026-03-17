interface MoodEntry { score: number; timestamp: string; label?: string; }
interface MemoryData {
  triggers: string[];
  mood_history: MoodEntry[];
  session_count: number;
  last_session: string;
  profile_summary: string;
}
interface MemoryPanelProps {
  data: MemoryData | null;
  loading: boolean;
  pulsing: boolean;
  onClose?: () => void;
}

function moodConfig(score?: number) {
  if (score == null) return { label: "No Data", emoji: "💭", color: "from-zinc-700 to-zinc-800", text: "text-zinc-400" };
  if (score >= 7) return { label: "Positive", emoji: "✨", color: "from-emerald-400 to-emerald-600", text: "text-emerald-400" };
  if (score >= 4) return { label: "Neutral", emoji: "⚖️", color: "from-amber-400 to-amber-600", text: "text-amber-400" };
  return { label: "Struggling", emoji: "🌧️", color: "from-rose-400 to-rose-600", text: "text-rose-400" };
}

export default function MemoryPanel({ data, loading, pulsing, onClose }: MemoryPanelProps) {
  const latest = data?.mood_history?.slice(-1)[0];
  const mood = moodConfig(latest?.score);

  return (
    <aside className="flex flex-col h-full bg-transparent">

      {/* ── Header ── */}
      <div className="flex items-center justify-between px-5 sm:px-6 py-4 sm:py-5 border-b border-white/[0.04]">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-zinc-900 border border-white/10 flex items-center justify-center shadow-inner">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="url(#mg)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <defs><linearGradient id="mg" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stopColor="#34d399"/><stop offset="100%" stopColor="#818cf8"/></linearGradient></defs>
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
            </svg>
          </div>
          <div>
            <h2 className="font-display font-semibold text-sm text-zinc-100 tracking-wide">Memory Core</h2>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className="relative flex h-1.5 w-1.5">
                {pulsing && <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75" />}
                <span className={`relative inline-flex h-1.5 w-1.5 rounded-full transition-colors duration-500 ${pulsing ? "bg-indigo-400" : "bg-zinc-600"}`} />
              </span>
              <span className="text-[9px] uppercase tracking-widest font-semibold text-zinc-500">
                {pulsing ? "Syncing..." : "Up to date"}
              </span>
            </div>
          </div>
        </div>
        {onClose && (
          <button onClick={onClose} className="md:hidden w-8 h-8 rounded-full bg-white/5 flex items-center justify-center text-zinc-400 hover:text-white transition-colors" aria-label="Close sidebar">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M18 6L6 18M6 6l12 12"/></svg>
          </button>
        )}
      </div>

      {loading ? (
        <div className="flex-1 px-5 sm:px-6 py-5 flex flex-col gap-4">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-16 rounded-2xl bg-zinc-900/50 border border-white/5 animate-pulse" style={{ animationDelay: `${i * 120}ms` }} />
          ))}
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto px-5 sm:px-6 py-5 flex flex-col gap-4 custom-scrollbar">

          {/* ── AI Profile Summary ── */}
          {data?.profile_summary && (
            <div className="rounded-2xl bg-gradient-to-br from-indigo-500/[0.08] to-violet-500/[0.04] border border-indigo-500/15 p-4">
              <p className="text-[9px] sm:text-[10px] font-semibold uppercase tracking-widest text-indigo-400/80 mb-2 flex items-center gap-1.5">
                <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="8" r="4"/><path d="M6 20v-2a6 6 0 0 1 12 0v2"/></svg>
                AI Profile
              </p>
              <p className="text-xs text-zinc-300 leading-relaxed italic">"{data.profile_summary}"</p>
            </div>
          )}

          {/* ── Mood Card ── */}
          <div className="relative overflow-hidden rounded-2xl glass-card p-4 sm:p-5 group">
            <div className={`absolute -right-10 -top-10 w-32 h-32 rounded-full bg-gradient-to-br ${mood.color} opacity-10 blur-2xl group-hover:opacity-20 transition-opacity duration-500`} />
            <div className="flex justify-between items-start mb-3 relative z-10">
              <p className="text-[10px] sm:text-[11px] font-semibold uppercase tracking-widest text-zinc-500">Mental State</p>
              <span className="text-xl sm:text-2xl">{mood.emoji}</span>
            </div>
            <div className="relative z-10">
              <div className="flex items-end gap-2 mb-2">
                <span className="font-display font-semibold text-xl sm:text-2xl text-zinc-100">
                  {latest?.score ?? "--"}<span className="text-xs sm:text-sm text-zinc-600 font-medium">/10</span>
                </span>
                <span className={`text-xs sm:text-[13px] font-medium mb-1 ${mood.text}`}>{mood.label}</span>
              </div>
              <div className="h-1 sm:h-1.5 w-full bg-black/40 rounded-full overflow-hidden border border-white/5">
                <div
                  className={`h-full rounded-full bg-gradient-to-r ${mood.color} transition-all duration-1000 ease-out`}
                  style={{ width: latest?.score != null ? `${(latest.score / 10) * 100}%` : "0%" }}
                />
              </div>
            </div>
          </div>

          {/* ── Stats Grid ── */}
          <div className="grid grid-cols-2 gap-2 sm:gap-3">
            <div className="glass-card rounded-2xl p-3 sm:p-4 flex flex-col justify-center">
              <p className="text-[9px] sm:text-[10px] font-semibold uppercase tracking-[0.2em] text-zinc-500 mb-1 flex items-center gap-1.5">
                <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>
                Sessions
              </p>
              <span className="font-display font-semibold text-lg sm:text-xl text-zinc-100">{data?.session_count ?? 0}</span>
            </div>
            <div className="glass-card rounded-2xl p-3 sm:p-4 flex flex-col justify-center">
              <p className="text-[9px] sm:text-[10px] font-semibold uppercase tracking-[0.2em] text-zinc-500 mb-1 flex items-center gap-1.5">
                <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                Last Visit
              </p>
              <span className="font-sans font-medium text-xs sm:text-sm text-zinc-300">
                {data?.last_session && data.last_session !== "No sessions yet"
                  ? new Date(data.last_session).toLocaleDateString(undefined, { month: "short", day: "numeric" })
                  : "—"}
              </span>
            </div>
          </div>

          {/* ── Recurring Themes ── */}
          <div className="glass-card rounded-2xl p-4 sm:p-5 border-l-[3px] border-l-indigo-500/50">
            <p className="text-[10px] sm:text-[11px] font-semibold uppercase tracking-widest text-zinc-400 mb-3">Recurring Themes</p>
            {data?.triggers?.length ? (
              <div className="flex flex-wrap gap-1.5 sm:gap-2">
                {data.triggers.map((t) => (
                  <span key={t} className="text-[11px] sm:text-xs font-medium px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-lg bg-indigo-500/10 text-indigo-300 border border-indigo-500/20 capitalize shadow-sm">{t}</span>
                ))}
              </div>
            ) : (
              <p className="text-[10px] sm:text-[11px] text-zinc-600 italic text-center py-2">Themes will extract as you share more...</p>
            )}
          </div>

          {/* ── Sentiment Arc ── */}
          {data?.mood_history && data.mood_history.length > 0 && (
            <div className="glass-card rounded-2xl p-4 sm:p-5">
              <p className="text-[10px] sm:text-[11px] font-semibold uppercase tracking-widest text-zinc-400 mb-3 sm:mb-4">Sentiment Arc</p>
              <div className="flex items-end gap-1 sm:gap-1.5 h-12 sm:h-14">
                {data.mood_history.slice(-14).map((m, i) => {
                  const val = m.score ?? 5;
                  const pct = Math.max(10, (val / 10) * 100);
                  const color = val >= 7 ? "from-emerald-400 to-emerald-600" : val >= 4 ? "from-indigo-400 to-indigo-600" : "from-rose-400 to-rose-600";
                  return (
                    <div key={i} className="flex-1 flex flex-col justify-end group cursor-pointer relative">
                      <div className="absolute -top-7 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity bg-zinc-800 text-[10px] font-semibold px-2 py-0.5 rounded text-white z-10 pointer-events-none">{val}</div>
                      <div className={`w-full rounded-sm bg-gradient-to-t ${color} opacity-60 group-hover:opacity-100 transition-all duration-300`} style={{ height: `${pct}%` }} />
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <div className="mt-auto pt-3 pb-2">
            <p className="text-[9px] sm:text-[10px] text-zinc-600 text-center font-medium px-2">
              🔒 Data secured via Local EverMemOS Enclave.
            </p>
          </div>
        </div>
      )}
    </aside>
  );
}

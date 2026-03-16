import { useState, useEffect, useCallback, useRef } from "react";
import MemoryPanel from "./components/MemoryPanel";
import ChatWindow from "./components/ChatWindow";

const BACKEND_URL = "http://localhost:8000";
const USER_ID = "user_001";

interface MemoryData {
  triggers: string[];
  mood_history: { score: number; timestamp: string; label?: string }[];
  session_count: number;
  last_session: string;
}

export default function App() {
  const [memoryData, setMemoryData] = useState<MemoryData | null>(null);
  const [memoryLoading, setMemoryLoading] = useState(true);
  const [pulsing, setPulsing] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const pulseTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchMemory = useCallback(async () => {
    try {
      const res = await fetch(`${BACKEND_URL}/memory/${USER_ID}`);
      if (res.ok) setMemoryData(await res.json());
    } catch {
      /* silent */
    } finally {
      setMemoryLoading(false);
    }
  }, []);

  useEffect(() => { fetchMemory(); }, [fetchMemory]);

  const handleMessageSent = useCallback(() => {
    setPulsing(true);
    if (pulseTimer.current) clearTimeout(pulseTimer.current);
    pulseTimer.current = setTimeout(() => setPulsing(false), 2500);
    setTimeout(() => fetchMemory(), 1200);
  }, [fetchMemory]);

  return (
    <div className="flex flex-col items-center justify-center h-[100dvh] w-screen overflow-hidden bg-[#050505] relative selection:bg-emerald-500/30 selection:text-emerald-200">
      
      {/* ── Ambient Background (Outside the main app window) ── */}
      <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden" aria-hidden="true">
        {/* Top left emerald glow */}
        <div className="absolute top-[-10%] left-[-10%] w-[60vw] md:w-[40vw] h-[60vw] md:h-[40vw] rounded-full opacity-[0.08] blur-[100px] bg-emerald-500 animate-float" style={{ animationDuration: '9s' }} />
        {/* Bottom right indigo glow */}
        <div className="absolute bottom-[-20%] right-[-10%] w-[70vw] md:w-[50vw] h-[70vw] md:h-[50vw] rounded-full opacity-[0.06] blur-[120px] bg-indigo-500 animate-float" style={{ animationDuration: '13s', animationDelay: '2s' }} />
      </div>

      {/* ── Main App Window (Floating on desktop, full screen on mobile) ── */}
      <div className="relative z-10 flex w-full h-[100dvh] lg:h-[90vh] lg:max-h-[850px] max-w-7xl mx-auto lg:rounded-3xl lg:border lg:border-white/10 lg:shadow-2xl lg:shadow-emerald-900/10 glass-panel overflow-hidden bg-zinc-950/40 backdrop-blur-2xl">
        
        {/* Left Panel — Memory Sidebar */}
        <div className={`
          absolute inset-y-0 left-0
          md:relative z-40 md:z-auto
          h-full w-[85vw] max-w-[340px] md:w-[300px] lg:w-[340px]
          flex-shrink-0
          transition-transform duration-400 cubic-bezier(0.16, 1, 0.3, 1)
          ${sidebarOpen ? "translate-x-0 shadow-2xl shadow-black/80 md:shadow-none" : "-translate-x-full md:translate-x-0 drop-shadow-xl md:drop-shadow-none"}
        `}>
          <div className="h-full border-r border-white/5 bg-zinc-950/95 md:bg-zinc-950/40 backdrop-blur-xl">
            <MemoryPanel
              data={memoryData}
              loading={memoryLoading}
              pulsing={pulsing}
              onClose={() => setSidebarOpen(false)}
            />
          </div>
        </div>

        {/* ── Mobile Overlay ── */}
        {sidebarOpen && (
          <div
            className="md:hidden absolute inset-0 z-30 bg-black/60 backdrop-blur-sm transition-opacity"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        {/* Right Panel — Chat */}
        <div className="flex-1 h-full flex flex-col min-w-0 bg-transparent relative z-20 md:z-auto w-full">
          {/* Mobile Sidebar Toggle - Positioned inside chat window on mobile */}
          {!sidebarOpen && (
            <button
              onClick={() => setSidebarOpen(true)}
              className="md:hidden absolute top-[14px] right-4 z-50 w-9 h-9 rounded-xl glass-panel border border-white/10 flex items-center justify-center text-zinc-400 hover:text-emerald-400 hover:bg-zinc-800/80 transition-all shadow-lg"
              aria-label="Toggle memory panel"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/>
                <rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>
              </svg>
            </button>
          )}

          <ChatWindow onMessageSent={handleMessageSent} />
        </div>
      </div>
      
    </div>
  );
}

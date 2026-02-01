"use client";

import { useDebug } from "@/lib/context/DebugContext";
import { useWebSocket } from "@/lib/context/WebSocketContext";
import type { DebugTab } from "@/lib/types/debug";
import { DebugStateViewer } from "./DebugStateViewer";
import { DebugEventLog } from "./DebugEventLog";
import { DebugPhaseControls } from "./DebugPhaseControls";
import { DebugPlayerManager } from "./DebugPlayerManager";
import { DebugSettings } from "./DebugSettings";

const TABS: { id: DebugTab; label: string; icon: string }[] = [
  { id: "state", label: "State", icon: "{ }" },
  { id: "events", label: "Events", icon: ">_" },
  { id: "phases", label: "Phases", icon: ">>>" },
  { id: "players", label: "Players", icon: "**" },
  { id: "settings", label: "Settings", icon: "⚙" },
];

export function DebugPanel() {
  const { state, isHydrated, togglePanel, setActiveTab } = useDebug();
  const { isConnected, gameState } = useWebSocket();

  // Don't render until hydrated to prevent hydration mismatch
  if (!isHydrated || !state.isOpen) return null;

  return (
    <div
      className="fixed right-0 top-0 h-full w-[480px] z-50
                 bg-black/90 backdrop-blur-md border-l border-cyan-500/30
                 flex flex-col font-mono text-sm"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-cyan-500/30">
        <div className="flex items-center gap-3">
          <span className="text-cyan-400 font-bold text-lg">[DEBUG]</span>
          <span
            className={`flex items-center gap-1.5 text-xs ${
              isConnected ? "text-green-400" : "text-red-400"
            }`}
          >
            <span
              className={`w-2 h-2 rounded-full ${
                isConnected ? "bg-green-400" : "bg-red-400"
              }`}
            />
            {isConnected ? "Connected" : "Disconnected"}
          </span>
        </div>
        <button
          onClick={togglePanel}
          className="text-gray-400 hover:text-white transition-colors text-xl"
          aria-label="Close debug panel"
        >
          ×
        </button>
      </div>

      {/* Room Info */}
      {gameState && (
        <div className="px-4 py-2 border-b border-cyan-500/20 text-xs text-gray-400 flex gap-4">
          <span>
            Room: <span className="text-cyan-300">{gameState.roomCode}</span>
          </span>
          <span>
            Phase: <span className="text-cyan-300">{gameState.phase}</span>
          </span>
          <span>
            Round:{" "}
            <span className="text-cyan-300">{gameState.currentRound}</span>
          </span>
          {gameState.gameType && (
            <span>
              Game: <span className="text-cyan-300">{gameState.gameType}</span>
            </span>
          )}
        </div>
      )}

      {/* Tab Navigation */}
      <div className="flex border-b border-cyan-500/30">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex-1 px-3 py-2.5 text-xs transition-colors
                       ${
                         state.activeTab === tab.id
                           ? "bg-cyan-500/20 text-cyan-400 border-b-2 border-cyan-400"
                           : "text-gray-400 hover:text-gray-200 hover:bg-white/5"
                       }`}
          >
            <span className="mr-1.5">[{tab.icon}]</span>
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="flex-1 overflow-hidden overflow-y-auto">
        {state.activeTab === "state" && <DebugStateViewer />}
        {state.activeTab === "events" && <DebugEventLog />}
        {state.activeTab === "phases" && <DebugPhaseControls />}
        {state.activeTab === "players" && <DebugPlayerManager />}
        {state.activeTab === "settings" && <DebugSettings />}
      </div>
    </div>
  );
}

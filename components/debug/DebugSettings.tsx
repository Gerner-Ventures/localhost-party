"use client";

import { useAgents } from "@/lib/context/AgentContext";
import { useAudio } from "@/lib/context/AudioContext";

export function DebugSettings() {
  const { agentsEnabled, setAgentsEnabled } = useAgents();
  const { muted, setMuted } = useAudio();

  return (
    <div className="p-4 space-y-6">
      <div>
        <h3 className="text-cyan-400 font-bold mb-3">AI Settings</h3>
        <div className="space-y-3">
          <label className="flex items-center justify-between p-3 bg-white/5 rounded-lg cursor-pointer hover:bg-white/10 transition-colors">
            <div>
              <div className="text-sm font-medium text-white">
                AI Agent Commentary
              </div>
              <div className="text-xs text-gray-400">
                AI hosts react to game events (uses ElevenLabs API)
              </div>
            </div>
            <button
              onClick={() => setAgentsEnabled(!agentsEnabled)}
              className={`px-3 py-1 rounded text-xs font-bold transition-colors ${
                agentsEnabled
                  ? "bg-green-600 text-white"
                  : "bg-gray-600 text-gray-300"
              }`}
            >
              {agentsEnabled ? "ON" : "OFF"}
            </button>
          </label>
        </div>
      </div>

      <div>
        <h3 className="text-cyan-400 font-bold mb-3">Audio Settings</h3>
        <div className="space-y-3">
          <label className="flex items-center justify-between p-3 bg-white/5 rounded-lg cursor-pointer hover:bg-white/10 transition-colors">
            <div>
              <div className="text-sm font-medium text-white">
                Sound Effects
              </div>
              <div className="text-xs text-gray-400">
                UI sounds and game audio
              </div>
            </div>
            <button
              onClick={() => setMuted(!muted)}
              className={`px-3 py-1 rounded text-xs font-bold transition-colors ${
                !muted ? "bg-green-600 text-white" : "bg-gray-600 text-gray-300"
              }`}
            >
              {muted ? "MUTED" : "ON"}
            </button>
          </label>
        </div>
      </div>

      <div className="text-xs text-gray-500 p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
        <div className="font-bold text-yellow-400 mb-1">Note</div>
        AI agents are OFF by default in development to save API credits. Trivia
        questions still use AI (Claude) regardless of this setting.
      </div>
    </div>
  );
}

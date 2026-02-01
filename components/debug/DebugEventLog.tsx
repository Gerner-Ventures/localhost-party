"use client";

import { useMemo } from "react";
import { useDebug } from "@/lib/context/DebugContext";

export function DebugEventLog() {
  const { state, clearEventLog, togglePause, setEventFilter } = useDebug();

  const filteredEvents = useMemo(() => {
    if (!state.eventFilter) return state.eventLog;
    const filter = state.eventFilter.toLowerCase();
    return state.eventLog.filter(
      (event) =>
        event.type.toLowerCase().includes(filter) ||
        JSON.stringify(event.payload).toLowerCase().includes(filter)
    );
  }, [state.eventLog, state.eventFilter]);

  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString("en-US", {
      hour12: false,
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      fractionalSecondDigits: 3,
    });
  };

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="flex items-center gap-2 px-4 py-2 border-b border-cyan-500/20">
        <input
          type="text"
          placeholder="Filter events..."
          value={state.eventFilter}
          onChange={(e) => setEventFilter(e.target.value)}
          className="flex-1 px-2 py-1 text-xs bg-black/50 border border-cyan-500/30
                     rounded text-white placeholder-gray-500
                     focus:outline-none focus:border-cyan-400"
        />
        <button
          onClick={togglePause}
          className={`px-3 py-1 text-xs rounded transition-colors ${
            state.isPaused
              ? "bg-yellow-600 hover:bg-yellow-500 text-white"
              : "bg-gray-600 hover:bg-gray-500 text-white"
          }`}
        >
          {state.isPaused ? "Resume" : "Pause"}
        </button>
        <button
          onClick={clearEventLog}
          className="px-3 py-1 text-xs bg-red-600 hover:bg-red-500
                     text-white rounded transition-colors"
        >
          Clear
        </button>
      </div>

      {/* Event Count */}
      <div className="px-4 py-1.5 text-xs text-gray-500 border-b border-cyan-500/10">
        {filteredEvents.length} events
        {state.eventFilter && ` (filtered from ${state.eventLog.length})`}
        {state.isPaused && (
          <span className="ml-2 text-yellow-400">[PAUSED]</span>
        )}
      </div>

      {/* Event List */}
      <div className="flex-1 overflow-auto">
        {filteredEvents.length === 0 ? (
          <div className="p-4 text-gray-500 text-center text-xs">
            {state.eventLog.length === 0
              ? "No events captured yet"
              : "No events match filter"}
          </div>
        ) : (
          <div className="divide-y divide-cyan-500/10">
            {filteredEvents.map((event) => (
              <div
                key={event.id}
                className="px-4 py-2 hover:bg-white/5 transition-colors"
              >
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-gray-500 text-[10px]">
                    {formatTime(event.timestamp)}
                  </span>
                  <span
                    className={`text-[10px] px-1.5 py-0.5 rounded ${
                      event.direction === "sent"
                        ? "bg-blue-500/20 text-blue-400"
                        : "bg-green-500/20 text-green-400"
                    }`}
                  >
                    {event.direction === "sent" ? "OUT" : "IN"}
                  </span>
                  <span className="text-cyan-300 text-xs font-medium">
                    {event.type}
                  </span>
                </div>
                {event.payload !== undefined && (
                  <pre className="text-gray-400 text-[10px] ml-4 whitespace-pre-wrap break-all max-h-24 overflow-auto">
                    {JSON.stringify(event.payload, null, 2)}
                  </pre>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

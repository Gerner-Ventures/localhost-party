"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { useDebug } from "@/lib/context/DebugContext";
import { useWebSocket } from "@/lib/context/WebSocketContext";

interface Command {
  id: string;
  label: string;
  description?: string;
  shortcut?: string;
  action: () => void;
  icon?: string;
  category?: string;
}

export function CommandMenu() {
  const {
    togglePanel,
    state: debugState,
    clearEventLog,
    togglePause,
  } = useDebug();
  const { gameState, isConnected } = useWebSocket();
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");

  // Extract stable values for memoization
  const debugIsOpen = debugState.isOpen;
  const debugIsPaused = debugState.isPaused;
  const roomCode = gameState?.roomCode;

  // Define available commands
  const commands: Command[] = useMemo(
    () => [
      // Debug commands
      {
        id: "toggle-debug",
        label: debugIsOpen ? "Close Debug Panel" : "Open Debug Panel",
        description: "Inspect game state, WebSocket events, and manage players",
        shortcut: "D",
        category: "Debug",
        action: () => {
          togglePanel();
          setIsOpen(false);
        },
        icon: "{ }",
      },
      {
        id: "clear-events",
        label: "Clear Event Log",
        description: "Clear all captured WebSocket events",
        category: "Debug",
        action: () => {
          clearEventLog();
          setIsOpen(false);
        },
        icon: "x",
      },
      {
        id: "toggle-pause",
        label: debugIsPaused ? "Resume Event Logging" : "Pause Event Logging",
        description: "Pause or resume WebSocket event capture",
        category: "Debug",
        action: () => {
          togglePause();
          setIsOpen(false);
        },
        icon: debugIsPaused ? ">" : "||",
      },
      // Vercel tools (trigger via keyboard since Vercel Toolbar uses its own shortcuts)
      {
        id: "vercel-toolbar",
        label: "Open Vercel Toolbar",
        description: "Access Vercel's dev tools (comments, flags, analytics)",
        shortcut: "V",
        category: "Vercel",
        action: () => {
          // Vercel Toolbar listens for 'v' key when focused
          // We can trigger it by dispatching a keyboard event
          const event = new KeyboardEvent("keydown", {
            key: "v",
            code: "KeyV",
            bubbles: true,
          });
          document.dispatchEvent(event);
          setIsOpen(false);
        },
        icon: "▲",
      },
      {
        id: "vercel-comments",
        label: "Toggle Vercel Comments",
        description: "Leave feedback on the current page",
        category: "Vercel",
        action: () => {
          // Open Vercel toolbar and navigate to comments
          window.open(
            `https://vercel.com/${process.env.NEXT_PUBLIC_VERCEL_TEAM_ID || ""}`,
            "_blank"
          );
          setIsOpen(false);
        },
        icon: "💬",
      },
      // Game commands
      {
        id: "copy-room-code",
        label: "Copy Room Code",
        description: roomCode
          ? `Copy "${roomCode}" to clipboard`
          : "No room code available",
        category: "Game",
        action: async () => {
          if (roomCode) {
            try {
              await navigator.clipboard.writeText(roomCode);
            } catch (error) {
              console.warn("Failed to copy room code:", error);
            }
          }
          setIsOpen(false);
        },
        icon: "#",
      },
      {
        id: "connection-status",
        label: isConnected ? "Connected to Server" : "Disconnected",
        description: isConnected
          ? "WebSocket connection is active"
          : "WebSocket connection lost",
        category: "Status",
        action: () => {
          setIsOpen(false);
        },
        icon: isConnected ? "●" : "○",
      },
    ],
    [
      debugIsOpen,
      debugIsPaused,
      togglePanel,
      clearEventLog,
      togglePause,
      roomCode,
      isConnected,
    ]
  );

  // Filter commands based on search
  const filteredCommands = useMemo(() => {
    if (!search) return commands;
    const lower = search.toLowerCase();
    return commands.filter(
      (cmd) =>
        cmd.label.toLowerCase().includes(lower) ||
        cmd.description?.toLowerCase().includes(lower) ||
        cmd.category?.toLowerCase().includes(lower)
    );
  }, [commands, search]);

  // Group commands by category
  const groupedCommands = useMemo(() => {
    const groups: Record<string, Command[]> = {};
    for (const cmd of filteredCommands) {
      const category = cmd.category || "Other";
      if (!groups[category]) groups[category] = [];
      groups[category].push(cmd);
    }
    return groups;
  }, [filteredCommands]);

  // Handle keyboard shortcuts
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      // Cmd/Ctrl + / to open menu
      if ((e.metaKey || e.ctrlKey) && e.key === "/") {
        e.preventDefault();
        setIsOpen((prev) => !prev);
        setSearch("");
        return;
      }

      // Escape to close
      if (e.key === "Escape" && isOpen) {
        e.preventDefault();
        setIsOpen(false);
        return;
      }

      // Enter to execute first command
      if (e.key === "Enter" && isOpen && filteredCommands.length > 0) {
        e.preventDefault();
        filteredCommands[0].action();
        return;
      }
    },
    [isOpen, filteredCommands]
  );

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  // Close on click outside
  const handleBackdropClick = useCallback(() => {
    setIsOpen(false);
  }, []);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-start justify-center pt-[15vh]"
      onClick={handleBackdropClick}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

      {/* Menu */}
      <div
        className="relative w-full max-w-lg bg-gray-900/95 border border-cyan-500/30
                   rounded-lg shadow-2xl shadow-cyan-500/10 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search Input */}
        <div className="border-b border-cyan-500/20">
          <input
            type="text"
            placeholder="Type a command..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full px-4 py-3 bg-transparent text-white text-lg
                       placeholder-gray-500 outline-none font-mono"
            autoFocus
          />
        </div>

        {/* Command List */}
        <div className="max-h-80 overflow-auto">
          {filteredCommands.length === 0 ? (
            <div className="px-4 py-8 text-center text-gray-500">
              No commands found
            </div>
          ) : (
            <div className="py-2">
              {Object.entries(groupedCommands).map(
                ([category, cmds], categoryIndex) => (
                  <div key={category}>
                    {/* Category Header */}
                    <div
                      className={`px-4 py-1.5 text-xs font-medium text-gray-500 uppercase tracking-wider
                                 ${categoryIndex > 0 ? "mt-2 border-t border-cyan-500/10 pt-2" : ""}`}
                    >
                      {category}
                    </div>
                    {/* Commands in Category */}
                    {cmds.map((cmd, cmdIndex) => {
                      const isFirst = categoryIndex === 0 && cmdIndex === 0;
                      return (
                        <button
                          key={cmd.id}
                          onClick={cmd.action}
                          className={`w-full px-4 py-2.5 flex items-center gap-3 text-left
                                     transition-colors hover:bg-cyan-500/10
                                     ${isFirst ? "bg-cyan-500/5" : ""}`}
                        >
                          {/* Icon */}
                          <span
                            className="w-7 h-7 flex items-center justify-center
                                       bg-cyan-500/20 text-cyan-400 rounded text-xs font-bold"
                          >
                            {cmd.icon || "?"}
                          </span>

                          {/* Label & Description */}
                          <div className="flex-1 min-w-0">
                            <div className="text-white font-medium text-sm">
                              {cmd.label}
                            </div>
                            {cmd.description && (
                              <div className="text-gray-500 text-xs truncate">
                                {cmd.description}
                              </div>
                            )}
                          </div>

                          {/* Shortcut */}
                          {cmd.shortcut && (
                            <kbd
                              className="px-2 py-1 bg-gray-800 text-gray-400 text-xs
                                         rounded border border-gray-700"
                            >
                              {cmd.shortcut}
                            </kbd>
                          )}
                        </button>
                      );
                    })}
                  </div>
                )
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div
          className="px-4 py-2 border-t border-cyan-500/20 flex items-center
                     justify-between text-xs text-gray-500"
        >
          <span>
            <kbd className="px-1.5 py-0.5 bg-gray-800 rounded mr-1">Enter</kbd>
            to select
          </span>
          <span>
            <kbd className="px-1.5 py-0.5 bg-gray-800 rounded mr-1">Esc</kbd>
            to close
          </span>
        </div>
      </div>
    </div>
  );
}

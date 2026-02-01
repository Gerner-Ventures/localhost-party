"use client";

import { useState, useCallback, useMemo } from "react";
import { useWebSocket } from "@/lib/context/WebSocketContext";
import { useDebug } from "@/lib/context/DebugContext";

/**
 * Syntax highlight JSON with colors for different value types
 */
function SyntaxHighlightedJSON({ data }: { data: unknown }) {
  const highlighted = useMemo(() => {
    const json = JSON.stringify(data, null, 2);
    if (!json) return null;

    // Split into tokens and colorize
    const parts: { text: string; className: string }[] = [];
    let i = 0;

    while (i < json.length) {
      const char = json[i];

      // String (key or value)
      if (char === '"') {
        const start = i;
        i++;
        while (i < json.length && (json[i] !== '"' || json[i - 1] === "\\")) {
          i++;
        }
        i++; // Include closing quote
        const str = json.slice(start, i);

        // Check if this is a key (followed by :)
        let j = i;
        while (j < json.length && /\s/.test(json[j])) j++;
        const isKey = json[j] === ":";

        parts.push({
          text: str,
          className: isKey ? "text-purple-400" : "text-amber-400",
        });
        continue;
      }

      // Number
      if (/[-\d]/.test(char)) {
        const start = i;
        while (i < json.length && /[-\d.eE+]/.test(json[i])) {
          i++;
        }
        parts.push({
          text: json.slice(start, i),
          className: "text-cyan-400",
        });
        continue;
      }

      // Boolean or null
      if (json.slice(i, i + 4) === "true") {
        parts.push({ text: "true", className: "text-green-400" });
        i += 4;
        continue;
      }
      if (json.slice(i, i + 5) === "false") {
        parts.push({ text: "false", className: "text-red-400" });
        i += 5;
        continue;
      }
      if (json.slice(i, i + 4) === "null") {
        parts.push({ text: "null", className: "text-gray-500" });
        i += 4;
        continue;
      }

      // Brackets and punctuation
      if (/[{}\[\]:,]/.test(char)) {
        parts.push({ text: char, className: "text-gray-400" });
        i++;
        continue;
      }

      // Whitespace
      if (/\s/.test(char)) {
        const start = i;
        while (i < json.length && /\s/.test(json[i])) {
          i++;
        }
        parts.push({ text: json.slice(start, i), className: "" });
        continue;
      }

      // Fallback
      parts.push({ text: char, className: "text-gray-300" });
      i++;
    }

    return parts;
  }, [data]);

  if (!highlighted) return null;

  return (
    <pre className="text-xs whitespace-pre-wrap break-words">
      {highlighted.map((part, idx) => (
        <span key={idx} className={part.className}>
          {part.text}
        </span>
      ))}
    </pre>
  );
}

export function DebugStateViewer() {
  const { gameState } = useWebSocket();
  const { setGameState } = useDebug();
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    if (!gameState) return;
    try {
      await navigator.clipboard.writeText(JSON.stringify(gameState, null, 2));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback for older browsers
      const text = JSON.stringify(gameState, null, 2);
      const textarea = document.createElement("textarea");
      textarea.value = text;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }, [gameState]);

  const handleEdit = useCallback(() => {
    setEditValue(JSON.stringify(gameState, null, 2));
    setIsEditing(true);
    setError(null);
  }, [gameState]);

  const handleApply = useCallback(() => {
    try {
      const parsed = JSON.parse(editValue);
      // Remove fields that shouldn't be directly set (destructure and discard)
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { roomCode: _roomCode, players: _players, ...rest } = parsed;
      setGameState(rest);
      setIsEditing(false);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Invalid JSON");
    }
  }, [editValue, setGameState]);

  const handleCancel = useCallback(() => {
    setIsEditing(false);
    setError(null);
  }, []);

  if (!gameState) {
    return (
      <div className="p-4 text-gray-500 text-center">
        No game state available. Join a room first.
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="flex items-center gap-2 px-4 py-2 border-b border-cyan-500/20">
        {isEditing ? (
          <>
            <button
              onClick={handleApply}
              className="px-3 py-1 text-xs bg-green-600 hover:bg-green-500
                         text-white rounded transition-colors"
            >
              Apply
            </button>
            <button
              onClick={handleCancel}
              className="px-3 py-1 text-xs bg-gray-600 hover:bg-gray-500
                         text-white rounded transition-colors"
            >
              Cancel
            </button>
            {error && (
              <span className="text-red-400 text-xs ml-2">{error}</span>
            )}
          </>
        ) : (
          <>
            <button
              onClick={handleEdit}
              className="px-3 py-1 text-xs bg-cyan-600 hover:bg-cyan-500
                         text-white rounded transition-colors"
            >
              Edit
            </button>
            <button
              onClick={handleCopy}
              className={`px-3 py-1 text-xs rounded transition-colors ${
                copied
                  ? "bg-green-600 text-white"
                  : "bg-gray-600 hover:bg-gray-500 text-white"
              }`}
            >
              {copied ? "Copied!" : "Copy"}
            </button>
          </>
        )}
      </div>

      {/* State Display/Editor */}
      <div className="flex-1 overflow-auto p-4">
        {isEditing ? (
          <textarea
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            className="w-full h-full bg-black/50 text-green-400 font-mono text-xs
                       border border-cyan-500/30 rounded p-3 resize-none
                       focus:outline-none focus:border-cyan-400"
            spellCheck={false}
          />
        ) : (
          <SyntaxHighlightedJSON data={gameState} />
        )}
      </div>
    </div>
  );
}

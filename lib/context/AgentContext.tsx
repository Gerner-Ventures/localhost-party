"use client";

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
} from "react";
import { useWebSocket } from "./WebSocketContext";
import { useAudio } from "./AudioContext";
import type { AgentSpeakPayload } from "../types/websocket";
import type { VoiceId, NarratorOptions } from "../audio/types";

interface AgentContextValue {
  /** Whether AI agents are enabled */
  agentsEnabled: boolean;
  /** Toggle all agents on/off */
  setAgentsEnabled: (enabled: boolean) => void;
  /** Currently speaking agent (if any) */
  speakingAgent: string | null;
  /** Queue of pending agent speeches */
  speechQueue: AgentSpeakPayload[];
  /** Manually clear the speech queue */
  clearSpeechQueue: () => void;
}

interface AgentState {
  agentsEnabled: boolean;
  speakingAgent: string | null;
  speechQueue: AgentSpeakPayload[];
}

const AgentContext = createContext<AgentContextValue | undefined>(undefined);

const STORAGE_KEY = "localhost-party-agent-settings";

interface AgentProviderProps {
  children: React.ReactNode;
}

/**
 * AgentProvider listens for agent:speak events from the WebSocket
 * and queues them for the narrator to speak.
 */
export function AgentProvider({ children }: AgentProviderProps) {
  const { socket, emit, gameState } = useWebSocket();
  const { speak, isSpeaking, muted, stopSpeaking } = useAudio();

  const [state, setState] = useState<AgentState>(() => {
    // Default to OFF in development to save API credits
    const defaultEnabled = process.env.NODE_ENV === "production";

    if (typeof window === "undefined") {
      return {
        agentsEnabled: defaultEnabled,
        speakingAgent: null,
        speechQueue: [],
      };
    }

    // Load saved preference
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        return {
          agentsEnabled: parsed.agentsEnabled ?? defaultEnabled,
          speakingAgent: null,
          speechQueue: [],
        };
      } catch {
        // Invalid JSON, use defaults
      }
    }

    return {
      agentsEnabled: defaultEnabled,
      speakingAgent: null,
      speechQueue: [],
    };
  });

  // Save preference to localStorage
  useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ agentsEnabled: state.agentsEnabled })
      );
    }
  }, [state.agentsEnabled]);

  // Clear speech queue
  const clearSpeechQueue = useCallback(() => {
    setState((prev) => ({ ...prev, speechQueue: [], speakingAgent: null }));
  }, []);

  // Track recently spoken texts to prevent duplicates (text → timestamp)
  const recentTextsRef = useRef<Map<string, number>>(new Map());

  // Use ref for agentsEnabled so the socket listener doesn't re-register on toggle
  const agentsEnabledRef = useRef(state.agentsEnabled);
  useEffect(() => {
    agentsEnabledRef.current = state.agentsEnabled;
  }, [state.agentsEnabled]);

  // Flush stale speech when game phase changes
  // Phase changes come from WebSocket (external system), so setState in effect is appropriate
  const prevPhaseRef = useRef(gameState?.phase);
  useEffect(() => {
    const currentPhase = gameState?.phase;
    if (currentPhase && currentPhase !== prevPhaseRef.current) {
      prevPhaseRef.current = currentPhase;
      // eslint-disable-next-line react-hooks/set-state-in-effect -- phase changes come from WebSocket (external system)
      clearSpeechQueue();
      stopSpeaking();
    }
  }, [gameState?.phase, clearSpeechQueue, stopSpeaking]);

  // Listen for agent:speak events
  useEffect(() => {
    if (!socket) return;

    const handleAgentSpeak = (payload: AgentSpeakPayload) => {
      if (!agentsEnabledRef.current) {
        console.log(
          `[Agent] Ignoring speech from ${payload.agentName} - agents disabled`
        );
        return;
      }

      // Deduplicate: skip if this exact text was already spoken recently
      const DEDUP_WINDOW_MS = 30000;
      const now = Date.now();

      // Lazy cleanup: remove expired entries
      for (const [text, timestamp] of recentTextsRef.current) {
        if (now - timestamp > DEDUP_WINDOW_MS) {
          recentTextsRef.current.delete(text);
        }
      }

      if (recentTextsRef.current.has(payload.text)) {
        console.log(
          `[Agent] Skipping duplicate speech from ${payload.agentName}`
        );
        return;
      }

      console.log(
        `[Agent] Received speech from ${payload.agentName}:`,
        payload.text
      );

      recentTextsRef.current.set(payload.text, now);

      // Single-slot replacement: at most 1 playing + 1 waiting.
      // New speech replaces any pending queued speech rather than accumulating.
      setState((prev) => {
        return { ...prev, speechQueue: [payload] };
      });
    };

    socket.on("agent:speak", handleAgentSpeak);

    return () => {
      socket.off("agent:speak", handleAgentSpeak);
    };
  }, [socket]);

  // Process next speech in queue
  const processNextSpeech = useCallback(() => {
    setState((prev) => {
      // Don't process if muted, already speaking, or queue is empty
      if (muted || isSpeaking || prev.speechQueue.length === 0) {
        return prev;
      }

      // Get highest priority speech
      const [nextSpeech, ...remainingQueue] = prev.speechQueue;
      if (!nextSpeech) return prev;

      // Schedule the speak call after state update
      queueMicrotask(() => {
        const options: NarratorOptions = {
          voice: nextSpeech.voice as VoiceId,
          emotion: nextSpeech.emotion,
          onComplete: () => {
            setState((p) => ({ ...p, speakingAgent: null }));
          },
          onError: (error) => {
            console.error(
              `[Agent] Speech error for ${nextSpeech.agentName}:`,
              error
            );
            setState((p) => ({ ...p, speakingAgent: null }));
          },
        };

        speak(nextSpeech.text, options).catch((error) => {
          console.error(`[Agent] Failed to speak:`, error);
          setState((p) => ({ ...p, speakingAgent: null }));
        });
      });

      return {
        ...prev,
        speakingAgent: nextSpeech.agentId,
        speechQueue: remainingQueue,
      };
    });
  }, [muted, isSpeaking, speak]);

  // Trigger queue processing when conditions change
  // Queue processing inherently requires state updates in response to external events (WebSocket)
  useEffect(() => {
    if (!muted && !isSpeaking && state.speechQueue.length > 0) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- queue processing responds to external WebSocket events
      processNextSpeech();
    }
  }, [muted, isSpeaking, state.speechQueue.length, processNextSpeech]);

  // Toggle agents enabled
  const setAgentsEnabled = useCallback(
    (enabled: boolean) => {
      setState((prev) => ({ ...prev, agentsEnabled: enabled }));

      // Notify server
      emit({
        type: "agent:toggle",
        payload: { enabled },
      });
    },
    [emit]
  );

  const value: AgentContextValue = {
    agentsEnabled: state.agentsEnabled,
    setAgentsEnabled,
    speakingAgent: state.speakingAgent,
    speechQueue: state.speechQueue,
    clearSpeechQueue,
  };

  return (
    <AgentContext.Provider value={value}>{children}</AgentContext.Provider>
  );
}

/**
 * Hook to use agent context
 */
export function useAgents(): AgentContextValue {
  const context = useContext(AgentContext);
  if (!context) {
    throw new Error("useAgents must be used within AgentProvider");
  }
  return context;
}

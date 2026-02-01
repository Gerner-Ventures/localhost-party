"use client";

import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  useRef,
} from "react";
import { useWebSocket } from "./WebSocketContext";
import type {
  DebugState,
  DebugContextValue,
  DebugEvent,
  DebugTab,
} from "../types/debug";
import type { GamePhase, GameState } from "../types/game";

const STORAGE_KEY = "localhost-party-debug-settings";
const MAX_EVENTS = 500;

const DebugContext = createContext<DebugContextValue | undefined>(undefined);

interface DebugProviderProps {
  children: React.ReactNode;
}

export function DebugProvider({ children }: DebugProviderProps) {
  const { socket, gameState, emit } = useWebSocket();
  const eventIdCounter = useRef(0);
  // Track which socket instance we've intercepted to handle reconnects
  const interceptedSocketRef = useRef<typeof socket | null>(null);

  // Initialize with default values for SSR compatibility
  const [state, setState] = useState<DebugState>({
    isOpen: false,
    activeTab: "state",
    eventLog: [],
    maxEvents: MAX_EVENTS,
    isPaused: false,
    eventFilter: "",
  });

  // Track hydration state - panel won't render until this is true
  const [isHydrated, setIsHydrated] = useState(false);

  // Restore state from localStorage after hydration (client-only)
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    let isOpen = false;
    let activeTab: DebugTab = "state";

    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        isOpen = parsed.isOpen ?? false;
        activeTab = parsed.activeTab ?? "state";
      } catch {
        // Invalid JSON, use defaults
      }
    }

    // Restore saved settings - this is a valid one-time initialization from localStorage
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setState((prev) => ({
      ...prev,
      isOpen,
      activeTab,
    }));
    setIsHydrated(true);
  }, []);

  // Track isPaused in a ref for use in socket interceptor
  const isPausedRef = useRef(state.isPaused);
  useEffect(() => {
    isPausedRef.current = state.isPaused;
  }, [state.isPaused]);

  // Persist panel state to localStorage
  useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          isOpen: state.isOpen,
          activeTab: state.activeTab,
        })
      );
    }
  }, [state.isOpen, state.activeTab]);

  // Log event helper - stable callback stored in ref
  const logEventCallback = useCallback(
    (event: Omit<DebugEvent, "id" | "timestamp">) => {
      setState((prev) => {
        if (prev.isPaused) return prev;

        const newEvent: DebugEvent = {
          ...event,
          id: `evt-${++eventIdCounter.current}`,
          timestamp: Date.now(),
        };

        const newLog = [newEvent, ...prev.eventLog].slice(0, prev.maxEvents);
        return { ...prev, eventLog: newLog };
      });
    },
    []
  );

  // Use ref to access callback in socket interceptor without re-subscribing
  const logEventRef = useRef(logEventCallback);
  useEffect(() => {
    logEventRef.current = logEventCallback;
  }, [logEventCallback]);

  // Intercept socket events for logging
  useEffect(() => {
    // Skip if no socket or already intercepted this specific socket instance
    if (!socket || interceptedSocketRef.current === socket) return;
    interceptedSocketRef.current = socket;

    // Listen to all incoming events
    const handleAnyEvent = (event: string, ...args: unknown[]) => {
      if (!isPausedRef.current && event !== "pong") {
        logEventRef.current?.({
          direction: "received",
          type: event,
          payload: args[0],
        });
      }
    };

    socket.onAny(handleAnyEvent);

    return () => {
      socket.offAny(handleAnyEvent);
      // Clear ref so new socket instances can be intercepted
      interceptedSocketRef.current = null;
    };
  }, [socket]);

  // Toggle panel
  const togglePanel = useCallback(() => {
    setState((prev) => ({ ...prev, isOpen: !prev.isOpen }));
  }, []);

  // Set active tab
  const setActiveTab = useCallback((tab: DebugTab) => {
    setState((prev) => ({ ...prev, activeTab: tab }));
  }, []);

  // Log event (public API)
  const logEvent = useCallback(
    (event: Omit<DebugEvent, "id" | "timestamp">) => {
      logEventRef.current?.(event);
    },
    []
  );

  // Clear event log
  const clearEventLog = useCallback(() => {
    setState((prev) => ({ ...prev, eventLog: [] }));
  }, []);

  // Toggle pause
  const togglePause = useCallback(() => {
    setState((prev) => ({ ...prev, isPaused: !prev.isPaused }));
  }, []);

  // Set event filter
  const setEventFilter = useCallback((filter: string) => {
    setState((prev) => ({ ...prev, eventFilter: filter }));
  }, []);

  // Helper to emit and log outgoing events
  const emitAndLog = useCallback(
    (type: string, payload: unknown) => {
      if (!isPausedRef.current) {
        logEventRef.current?.({
          direction: "sent",
          type,
          payload,
        });
      }
      emit({ type, payload } as Parameters<typeof emit>[0]);
    },
    [emit]
  );

  // Extract roomCode for stable dependency reference
  const roomCode = gameState?.roomCode;

  // Debug actions
  const setPhase = useCallback(
    (phase: GamePhase) => {
      if (!roomCode) return;
      emitAndLog("debug:set-phase", { roomCode, phase });
    },
    [emitAndLog, roomCode]
  );

  const addFakePlayer = useCallback(
    (name: string) => {
      if (!roomCode) return;
      emitAndLog("debug:add-player", { roomCode, name });
    },
    [emitAndLog, roomCode]
  );

  const removePlayer = useCallback(
    (playerId: string) => {
      if (!roomCode) return;
      emitAndLog("debug:remove-player", { roomCode, playerId });
    },
    [emitAndLog, roomCode]
  );

  const setPlayerScore = useCallback(
    (playerId: string, score: number) => {
      if (!roomCode) return;
      emitAndLog("debug:set-score", { roomCode, playerId, score });
    },
    [emitAndLog, roomCode]
  );

  const setGameStateAction = useCallback(
    (partialState: Partial<GameState>) => {
      if (!roomCode) return;
      emitAndLog("debug:set-state", { roomCode, partialState });
    },
    [emitAndLog, roomCode]
  );

  const resetGame = useCallback(() => {
    if (!roomCode) return;
    emitAndLog("game:restart", { roomCode });
  }, [emitAndLog, roomCode]);

  const value: DebugContextValue = {
    state,
    isHydrated,
    togglePanel,
    setActiveTab,
    logEvent,
    clearEventLog,
    togglePause,
    setEventFilter,
    setPhase,
    addFakePlayer,
    removePlayer,
    setPlayerScore,
    setGameState: setGameStateAction,
    resetGame,
  };

  return (
    <DebugContext.Provider value={value}>{children}</DebugContext.Provider>
  );
}

export function useDebug(): DebugContextValue {
  const context = useContext(DebugContext);
  if (!context) {
    throw new Error("useDebug must be used within DebugProvider");
  }
  return context;
}

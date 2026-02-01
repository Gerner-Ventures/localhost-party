import React, { useEffect } from "react";
import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, act } from "@testing-library/react";
import { DebugProvider, useDebug } from "../DebugContext";
import type { DebugContextValue } from "../../types/debug";

// Mock WebSocketContext
vi.mock("../WebSocketContext", () => ({
  useWebSocket: vi.fn(() => ({
    socket: null,
    gameState: { roomCode: "TEST", phase: "lobby", players: [] },
    emit: vi.fn(),
    isConnected: true,
  })),
}));

// Test component to access debug context
function TestComponent({
  onContextReady,
}: {
  onContextReady: (context: DebugContextValue) => void;
}) {
  const debugContext = useDebug();

  useEffect(() => {
    onContextReady(debugContext);
  }, [debugContext, onContextReady]);

  return null;
}

describe("DebugContext", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it("should provide initial state with panel closed", async () => {
    let debugContext: DebugContextValue | null = null;

    await act(async () => {
      render(
        <DebugProvider>
          <TestComponent
            onContextReady={(ctx) => {
              debugContext = ctx;
            }}
          />
        </DebugProvider>
      );
    });

    expect(debugContext).not.toBeNull();
    expect(debugContext!.state.isOpen).toBe(false);
    expect(debugContext!.state.activeTab).toBe("state");
    expect(debugContext!.state.eventLog).toEqual([]);
    expect(debugContext!.state.isPaused).toBe(false);
  });

  it("should toggle panel open/closed", async () => {
    let debugContext: DebugContextValue | null = null;

    await act(async () => {
      render(
        <DebugProvider>
          <TestComponent
            onContextReady={(ctx) => {
              debugContext = ctx;
            }}
          />
        </DebugProvider>
      );
    });

    expect(debugContext!.state.isOpen).toBe(false);

    await act(async () => {
      debugContext!.togglePanel();
    });

    expect(debugContext!.state.isOpen).toBe(true);

    await act(async () => {
      debugContext!.togglePanel();
    });

    expect(debugContext!.state.isOpen).toBe(false);
  });

  it("should change active tab", async () => {
    let debugContext: DebugContextValue | null = null;

    await act(async () => {
      render(
        <DebugProvider>
          <TestComponent
            onContextReady={(ctx) => {
              debugContext = ctx;
            }}
          />
        </DebugProvider>
      );
    });

    expect(debugContext!.state.activeTab).toBe("state");

    await act(async () => {
      debugContext!.setActiveTab("events");
    });

    expect(debugContext!.state.activeTab).toBe("events");

    await act(async () => {
      debugContext!.setActiveTab("players");
    });

    expect(debugContext!.state.activeTab).toBe("players");
  });

  it("should log events", async () => {
    let debugContext: DebugContextValue | null = null;

    await act(async () => {
      render(
        <DebugProvider>
          <TestComponent
            onContextReady={(ctx) => {
              debugContext = ctx;
            }}
          />
        </DebugProvider>
      );
    });

    expect(debugContext!.state.eventLog.length).toBe(0);

    await act(async () => {
      debugContext!.logEvent({
        direction: "sent",
        type: "test:event",
        payload: { foo: "bar" },
      });
    });

    expect(debugContext!.state.eventLog.length).toBe(1);
    expect(debugContext!.state.eventLog[0].type).toBe("test:event");
    expect(debugContext!.state.eventLog[0].direction).toBe("sent");
    expect(debugContext!.state.eventLog[0].payload).toEqual({ foo: "bar" });
  });

  it("should not log events when paused", async () => {
    let debugContext: DebugContextValue | null = null;

    await act(async () => {
      render(
        <DebugProvider>
          <TestComponent
            onContextReady={(ctx) => {
              debugContext = ctx;
            }}
          />
        </DebugProvider>
      );
    });

    // Pause logging
    await act(async () => {
      debugContext!.togglePause();
    });

    expect(debugContext!.state.isPaused).toBe(true);

    // Try to log an event
    await act(async () => {
      debugContext!.logEvent({
        direction: "sent",
        type: "test:event",
        payload: {},
      });
    });

    // Event should not be logged
    expect(debugContext!.state.eventLog.length).toBe(0);
  });

  it("should clear event log", async () => {
    let debugContext: DebugContextValue | null = null;

    await act(async () => {
      render(
        <DebugProvider>
          <TestComponent
            onContextReady={(ctx) => {
              debugContext = ctx;
            }}
          />
        </DebugProvider>
      );
    });

    // Log some events
    await act(async () => {
      debugContext!.logEvent({
        direction: "sent",
        type: "event1",
        payload: {},
      });
      debugContext!.logEvent({
        direction: "received",
        type: "event2",
        payload: {},
      });
    });

    expect(debugContext!.state.eventLog.length).toBe(2);

    // Clear log
    await act(async () => {
      debugContext!.clearEventLog();
    });

    expect(debugContext!.state.eventLog.length).toBe(0);
  });

  it("should set event filter", async () => {
    let debugContext: DebugContextValue | null = null;

    await act(async () => {
      render(
        <DebugProvider>
          <TestComponent
            onContextReady={(ctx) => {
              debugContext = ctx;
            }}
          />
        </DebugProvider>
      );
    });

    expect(debugContext!.state.eventFilter).toBe("");

    await act(async () => {
      debugContext!.setEventFilter("game:");
    });

    expect(debugContext!.state.eventFilter).toBe("game:");
  });

  it("should persist panel state to localStorage", async () => {
    let debugContext: DebugContextValue | null = null;

    await act(async () => {
      render(
        <DebugProvider>
          <TestComponent
            onContextReady={(ctx) => {
              debugContext = ctx;
            }}
          />
        </DebugProvider>
      );
    });

    // Open panel and change tab
    await act(async () => {
      debugContext!.togglePanel();
      debugContext!.setActiveTab("events");
    });

    // Check localStorage
    const saved = JSON.parse(
      localStorage.getItem("localhost-party-debug-settings") || "{}"
    );

    expect(saved.isOpen).toBe(true);
    expect(saved.activeTab).toBe("events");
  });

  it("should load panel state from localStorage on mount", async () => {
    // Pre-populate localStorage
    localStorage.setItem(
      "localhost-party-debug-settings",
      JSON.stringify({ isOpen: true, activeTab: "players" })
    );

    let debugContext: DebugContextValue | null = null;

    await act(async () => {
      render(
        <DebugProvider>
          <TestComponent
            onContextReady={(ctx) => {
              debugContext = ctx;
            }}
          />
        </DebugProvider>
      );
    });

    expect(debugContext!.state.isOpen).toBe(true);
    expect(debugContext!.state.activeTab).toBe("players");
  });

  it("should throw error when useDebug is used outside provider", () => {
    // Suppress console.error for this test
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    expect(() => {
      render(<TestComponent onContextReady={() => {}} />);
    }).toThrow("useDebug must be used within DebugProvider");

    consoleSpy.mockRestore();
  });
});

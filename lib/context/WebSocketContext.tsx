"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useRef,
  ReactNode,
} from "react";
import { io, Socket } from "socket.io-client";
import type { WebSocketEvent, GameState, Player } from "@/lib/types";

interface WebSocketContextType {
  socket: Socket | null;
  isConnected: boolean;
  gameState: GameState | null;
  emit: (event: WebSocketEvent) => void;
  joinRoom: (roomCode: string, playerName: string) => Promise<Player>;
}

const WebSocketContext = createContext<WebSocketContextType | null>(null);

export function WebSocketProvider({ children }: { children: ReactNode }) {
  const [socket, setSocket] = useState<Socket | null>(null);
  const hasLoggedWarningRef = useRef(false);
  const [isConnected, setIsConnected] = useState(false);
  const [gameState, setGameState] = useState<GameState | null>(null);

  useEffect(() => {
    // Check if WebSocket URL is configured
    const wsUrl = process.env.NEXT_PUBLIC_WS_URL;
    if (!wsUrl) {
      console.warn(
        "⚠️ NEXT_PUBLIC_WS_URL not configured. WebSocket features disabled."
      );
      return;
    }

    const socketInstance = io(wsUrl, {
      transports: ["websocket"],
      autoConnect: true,
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      reconnectionAttempts: 3, // Limit reconnection attempts
    });

    let hasConnected = false;

    socketInstance.on("connect", () => {
      console.log("✅ WebSocket connected");
      hasConnected = true;
      setIsConnected(true);
      hasLoggedWarningRef.current = false;
      if (connectionTimeout) clearTimeout(connectionTimeout);
    });

    socketInstance.on("disconnect", (reason) => {
      console.log(`⚠️ WebSocket disconnected: ${reason}`);
      setIsConnected(false);
    });

    socketInstance.on("game:state-update", (state: GameState) => {
      console.log("📦 Game state update:", state);
      setGameState(state);
    });

    socketInstance.on("connect_error", () => {
      if (!hasLoggedWarningRef.current && !hasConnected) {
        console.warn(
          "⚠️ WebSocket server not available. This is expected if Issue #2 (WebSocket Server) is not yet implemented.\n" +
            "UI will work but real-time features will be disabled until the server is running."
        );
        hasLoggedWarningRef.current = true;
      }
    });

    // Set timeout to stop reconnection attempts after initial failure
    const connectionTimeout = setTimeout(() => {
      if (!hasConnected) {
        socketInstance.close();
      }
    }, 5000);

    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSocket(socketInstance);

    return () => {
      if (connectionTimeout) clearTimeout(connectionTimeout);
      socketInstance.close();
    };
  }, []);

  const emit = useCallback(
    (event: WebSocketEvent) => {
      if (socket?.connected) {
        console.log("📤 Emitting event:", event.type);
        socket.emit(event.type, event.payload);
      } else {
        console.warn(
          `📴 Cannot emit event "${event.type}" - WebSocket not connected.\n` +
            "This is expected until Issue #2 (WebSocket Server) is implemented."
        );
      }
    },
    [socket]
  );

  // Promise-based join that waits for server confirmation
  const joinRoom = useCallback(
    (roomCode: string, playerName: string): Promise<Player> => {
      return new Promise((resolve, reject) => {
        if (!socket?.connected) {
          reject(new Error("WebSocket not connected"));
          return;
        }

        const timeout = setTimeout(() => {
          socket.off("player:joined", onJoined);
          socket.off("player:error", onError);
          reject(new Error("Join timeout - server did not respond"));
        }, 10000); // 10 second timeout

        const onJoined = (player: Player) => {
          clearTimeout(timeout);
          socket.off("player:error", onError);
          resolve(player);
        };

        const onError = (error: { message: string }) => {
          clearTimeout(timeout);
          socket.off("player:joined", onJoined);
          reject(new Error(error.message));
        };

        socket.once("player:joined", onJoined);
        socket.once("player:error", onError);

        console.log("📤 Emitting player:join");
        socket.emit("player:join", { roomCode, name: playerName });
      });
    },
    [socket]
  );

  return (
    <WebSocketContext.Provider
      value={{ socket, isConnected, gameState, emit, joinRoom }}
    >
      {children}
    </WebSocketContext.Provider>
  );
}

export const useWebSocket = () => {
  const context = useContext(WebSocketContext);
  if (!context) {
    throw new Error("useWebSocket must be used within WebSocketProvider");
  }
  return context;
};

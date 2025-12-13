'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { io, Socket } from 'socket.io-client';
import type { WebSocketEvent, GameState } from '@/lib/types';

interface WebSocketContextType {
  socket: Socket | null;
  isConnected: boolean;
  gameState: GameState | null;
  emit: (event: WebSocketEvent) => void;
}

const WebSocketContext = createContext<WebSocketContextType | null>(null);

export function WebSocketProvider({ children }: { children: ReactNode }) {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [hasLoggedWarning, setHasLoggedWarning] = useState(false);

  useEffect(() => {
    // Check if WebSocket URL is configured
    const wsUrl = process.env.NEXT_PUBLIC_WS_URL;
    if (!wsUrl) {
      console.warn('⚠️ NEXT_PUBLIC_WS_URL not configured. WebSocket features disabled.');
      return;
    }

    const socketInstance = io(wsUrl, {
      transports: ['websocket'],
      autoConnect: true,
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      reconnectionAttempts: 3, // Limit reconnection attempts
    });

    let connectionTimeout: NodeJS.Timeout;
    let hasConnected = false;

    socketInstance.on('connect', () => {
      console.log('✅ WebSocket connected');
      hasConnected = true;
      setIsConnected(true);
      setHasLoggedWarning(false);
      if (connectionTimeout) clearTimeout(connectionTimeout);
    });

    socketInstance.on('disconnect', (reason) => {
      console.log(`⚠️ WebSocket disconnected: ${reason}`);
      setIsConnected(false);
    });

    socketInstance.on('game:state-update', (state: GameState) => {
      console.log('📦 Game state update:', state);
      setGameState(state);
    });

    socketInstance.on('connect_error', (error) => {
      if (!hasLoggedWarning && !hasConnected) {
        console.warn(
          '⚠️ WebSocket server not available. This is expected if Issue #2 (WebSocket Server) is not yet implemented.\n' +
          'UI will work but real-time features will be disabled until the server is running.'
        );
        setHasLoggedWarning(true);
      }
    });

    // Set timeout to stop reconnection attempts after initial failure
    connectionTimeout = setTimeout(() => {
      if (!hasConnected) {
        socketInstance.close();
      }
    }, 5000);

    setSocket(socketInstance);

    return () => {
      if (connectionTimeout) clearTimeout(connectionTimeout);
      socketInstance.close();
    };
  }, []);

  const emit = (event: WebSocketEvent) => {
    if (socket?.connected) {
      console.log('📤 Emitting event:', event.type);
      socket.emit(event.type, event.payload);
    } else {
      console.warn(
        `📴 Cannot emit event "${event.type}" - WebSocket not connected.\n` +
        'This is expected until Issue #2 (WebSocket Server) is implemented.'
      );
    }
  };

  return (
    <WebSocketContext.Provider value={{ socket, isConnected, gameState, emit }}>
      {children}
    </WebSocketContext.Provider>
  );
}

export const useWebSocket = () => {
  const context = useContext(WebSocketContext);
  if (!context) {
    throw new Error('useWebSocket must be used within WebSocketProvider');
  }
  return context;
};

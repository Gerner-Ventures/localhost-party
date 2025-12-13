export interface Player {
  id: string;
  name: string;
  roomCode: string;
  score: number;
  isConnected: boolean;
  socketId?: string;
}

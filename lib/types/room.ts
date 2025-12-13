export type RoomStatus = 'waiting' | 'playing' | 'finished';

export interface Room {
  id: string;
  code: string;
  status: RoomStatus;
  createdAt: Date;
  hostId?: string;
}

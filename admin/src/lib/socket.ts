import { useEffect } from 'react';
import { io, type Socket } from 'socket.io-client';
import { API_URL } from './api';

let socket: Socket | null = null;

export function connectSocket(): Socket {
  if (socket?.connected) return socket;
  socket?.close();
  socket = io(API_URL, { auth: { token: localStorage.getItem('pf.accessToken') ?? '' } });
  return socket;
}

export function useRealtime(event: string, cb: () => void) {
  useEffect(() => {
    const s = connectSocket();
    s.on(event, cb);
    return () => {
      s.off(event, cb);
    };
  }, [event, cb]);
}

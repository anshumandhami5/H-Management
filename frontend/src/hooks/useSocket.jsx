// src/hooks/useSocket.jsx
import { useEffect, useRef } from 'react';
import { io } from 'socket.io-client';

const API_BASE = import.meta.env.VITE_API_BASE || 'http://127.0.0.1:5000';

export default function useSocket(onEvent, opts = {}) {
  const socketRef = useRef(null);

  useEffect(() => {
    // ensure we use same origin as backend and let socket.io handle path
    const socket = io(API_BASE, {
      path: '/socket.io',   // default, explicit for clarity
      transports: ['websocket', 'polling'],
      autoConnect: true,
      withCredentials: true,
      // optional auth: { token: ... }
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      console.log('socket connected', socket.id);
    });

    socket.on('connect_error', (err) => {
      console.error('socket connect_error', err);
    });

    socket.onAny((ev, payload) => {
      if (typeof onEvent === 'function') onEvent(ev, payload);
    });

    return () => {
      try { socket.disconnect(); } catch (e) { /* ignore */ }
      socketRef.current = null;
    };
  }, [API_BASE, onEvent]);

  return socketRef;
}

// src/hooks/useSocket.jsx
import { useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import { getAuth } from '../services/auth';

const API_BASE = import.meta.env.VITE_API_BASE || '';

export default function useSocket(onEvent) {
  // onEvent: (evName, payload) => {}
  const socketRef = useRef(null);

  useEffect(() => {
    const raw = getAuth();
    const token = raw?.token;
    const user = raw?.user;

    // connect with credentials (CORS must allow)
    const url = API_BASE || window.location.origin;
    const socket = io(url, {
      withCredentials: true,
      transports: ['websocket','polling'],
      auth: { token } // optional; server not using token but you may adapt
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      // join rooms so server can emit targeted events
      const userId = user?._id || user?.id || user?.sub;
      socket.emit('join', { userId, role: user?.role, doctorId: user?.role === 'doctor' ? userId : undefined });
    });

    // common appointment events
    socket.on('appointment.created', (payload) => onEvent && onEvent('created', payload));
    socket.on('appointment.updated', (payload) => onEvent && onEvent('updated', payload));
    socket.on('connect_error', (err) => console.warn('Socket connect error', err));

    return () => {
      try { socket.disconnect(); } catch (e) {}
    };
  }, [onEvent]);

  return socketRef;
}

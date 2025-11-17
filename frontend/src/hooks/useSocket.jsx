// src/hooks/useSocket.jsx
import { useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import * as authService from '../services/auth';

const API_BASE = import.meta.env.VITE_API_BASE || 'http://127.0.0.1:5000';

/**
 * useSocket(onEvent)
 * - calls onEvent(eventName, payload) for any socket event
 * - automatically emits a "join" with userId/role/doctorId if auth present
 */
export default function useSocket(onEvent, opts = {}) {
  const socketRef = useRef(null);

  useEffect(() => {
    const socket = io(API_BASE, {
      path: '/socket.io',
      transports: ['websocket', 'polling'],
      autoConnect: true,
      withCredentials: true,
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      console.log('[socket] connected', socket.id);

      // Auto-join rooms using stored auth (if any)
      try {
        const raw = authService.getAuth?.();
        const user = raw?.user;
        const token = raw?.token;
        const userId = user?._id || user?.id || user?.sub || null;
        const role = user?.role || null;
        const doctorId = role === 'doctor' ? (userId) : (null);

        // emit join (backend will accept and put socket in rooms)
        socket.emit('join', { userId: userId ? String(userId) : null, role, doctorId: doctorId ? String(doctorId) : undefined });
        console.log('[socket] emitted join', { userId, role, doctorId });
      } catch (e) {
        console.warn('[socket] auto-join failed', e);
      }
    });

    socket.on('connect_error', (err) => {
      console.error('[socket] connect_error', err);
    });

    socket.onAny((ev, payload) => {
      if (typeof onEvent === 'function') onEvent(ev, payload);
    });

    return () => {
      try { socket.disconnect(); } catch (_) { /* ignore */ }
      socketRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [API_BASE, /* intentionally not including onEvent reference here to avoid reattach*/]);

  return socketRef;
}

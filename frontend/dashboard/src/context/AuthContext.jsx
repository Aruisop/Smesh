import React, { createContext, useState, useEffect, useContext, useCallback, useRef } from 'react';
import axios from 'axios';
import { io } from 'socket.io-client';

const AuthContext = createContext(null);

const API_URL = import.meta.env.VITE_API_URL || '/api';
const WS_URL = import.meta.env.VITE_WS_URL || window.location.origin;

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const socketRef = useRef(null);

  const api = axios.create({
    baseURL: API_URL,
    withCredentials: true,
  });

  api.interceptors.request.use((config) => {
    const token = localStorage.getItem('sentinel_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  });

  // Initialize Socket.IO when user is authenticated
  const initSocket = useCallback((token) => {
    if (socketRef.current?.connected) return socketRef.current;

    const socket = io(WS_URL, {
      auth: { token },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 2000,
    });

    socket.on('connect', () => {
      console.log('[Socket.IO] Connected');
    });

    socket.on('connect_error', (err) => {
      console.warn('[Socket.IO] Connection error:', err.message);
    });

    socketRef.current = socket;
    return socket;
  }, []);

  const disconnectSocket = useCallback(() => {
    if (socketRef.current) {
      socketRef.current.disconnect();
      socketRef.current = null;
    }
  }, []);

  const verifyToken = useCallback(async (token) => {
    try {
      const response = await api.get('/auth/me', {
        headers: { Authorization: `Bearer ${token}` },
      });
      setUser(response.data.user);
      initSocket(token);
      return true;
    } catch (err) {
      console.error('[Auth] Token verification failed:', err.message);
      localStorage.removeItem('sentinel_token');
      setUser(null);
      return false;
    }
  }, [initSocket]);

  useEffect(() => {
    const init = async () => {
      const token = localStorage.getItem('sentinel_token');
      if (token) {
        await verifyToken(token);
      }
      setLoading(false);
    };
    init();

    return () => disconnectSocket();
  }, [verifyToken, disconnectSocket]);

  const handleOAuthCallback = useCallback(async (token) => {
    if (!token) {
      setError('No token received from OAuth');
      return false;
    }
    localStorage.setItem('sentinel_token', token);
    const success = await verifyToken(token);
    if (!success) setError('Failed to verify OAuth token');
    return success;
  }, [verifyToken]);

  const loginDemo = useCallback(async () => {
    try {
      setError(null);
      const response = await api.post('/auth/demo');
      const { token, user: userData } = response.data;
      localStorage.setItem('sentinel_token', token);
      setUser(userData);
      initSocket(token);
      return true;
    } catch (err) {
      console.error('[Auth] Demo login failed:', err.message);
      setError('Demo login failed. Is the API server running?');
      return false;
    }
  }, [initSocket]);

  const loginGithub = useCallback(() => {
    window.location.href = `${API_URL}/auth/github`;
  }, []);

  const logout = useCallback(async () => {
    try { await api.post('/auth/logout'); } catch {}
    localStorage.removeItem('sentinel_token');
    disconnectSocket();
    setUser(null);
  }, [disconnectSocket]);

  const value = {
    user,
    loading,
    error,
    setError,
    loginDemo,
    loginGithub,
    logout,
    handleOAuthCallback,
    api,
    socket: socketRef.current,
    token: localStorage.getItem('sentinel_token'),
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

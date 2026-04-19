import { useEffect, useRef, useState, useCallback } from 'react';
import getConfig from '../config/apiConfig';

const config = getConfig();
const MAX_BACKOFF = 30000; // 30 seconds max

/**
 * Custom hook for WebSocket connection with automatic reconnection
 * Features:
 * - Exponential backoff for reconnection
 * - Automatic health checks
 * - Message queuing during disconnection
 * - Manual reconnection support
 */
export const useWebSocket = (url = config.WS_URL, options = {}) => {
  const wsRef = useRef(null);
  const reconnectCountRef = useRef(0);
  const reconnectTimerRef = useRef(null);
  const messageQueueRef = useRef([]);
  const isManuallyClosedRef = useRef(false);

  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState(null);
  const [reconnecting, setReconnecting] = useState(false);

  const {
    onOpen = null,
    onMessage = null,
    onError = null,
    onClose = null,
    autoReconnect = true,
    maxRetries = config.MAX_RETRIES,
    initialBackoff = config.RETRY_BACKOFF,
  } = options;

  // Calculate exponential backoff with jitter
  const getBackoffDelay = useCallback(() => {
    const exponentialDelay = initialBackoff * Math.pow(2, reconnectCountRef.current);
    const jitter = Math.random() * 1000; // Add up to 1 second random jitter
    const delay = Math.min(exponentialDelay + jitter, MAX_BACKOFF);
    return delay;
  }, [initialBackoff]);

  const connect = useCallback(() => {
    if (isManuallyClosedRef.current) return;
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    try {
      console.log(`🔗 Connecting to WebSocket: ${url}`);
      const ws = new WebSocket(url);

      ws.onopen = () => {
        console.log('✅ WebSocket connected');
        setIsConnected(true);
        setReconnecting(false);
        setError(null);
        reconnectCountRef.current = 0;

        // Flush message queue
        while (messageQueueRef.current.length > 0) {
          const message = messageQueueRef.current.shift();
          try {
            ws.send(JSON.stringify(message));
          } catch (e) {
            console.error('Failed to send queued message:', e);
            messageQueueRef.current.unshift(message); // Re-queue on failure
            break;
          }
        }

        // Set up health check
        const healthCheckInterval = setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: 'ping' }));
          }
        }, 30000); // Every 30 seconds

        // Cleanup health check on close
        const originalClose = ws.close.bind(ws);
        ws.close = function() {
          clearInterval(healthCheckInterval);
          originalClose();
        };

        if (onOpen) onOpen();
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          // Ignore pong messages
          if (data.type === 'pong') return;
          if (onMessage) onMessage(data);
        } catch (e) {
          console.error('Failed to parse WebSocket message:', e);
        }
      };

      ws.onerror = (event) => {
        console.error('❌ WebSocket error:', event);
        const errorMsg = 'WebSocket connection failed';
        setError(errorMsg);
        if (onError) onError(event);
      };

      ws.onclose = () => {
        console.warn('⚠️ WebSocket closed');
        setIsConnected(false);
        if (onClose) onClose();

        // Attempt reconnection if not manually closed
        if (autoReconnect && !isManuallyClosedRef.current) {
          if (reconnectCountRef.current < maxRetries) {
            const backoff = getBackoffDelay();
            reconnectCountRef.current++;
            setReconnecting(true);
            console.log(`📡 Reconnecting in ${backoff.toFixed(0)}ms (attempt ${reconnectCountRef.current}/${maxRetries})`);

            reconnectTimerRef.current = setTimeout(() => {
              connect();
            }, backoff);
          } else {
            setError('Max reconnection attempts reached');
            console.error('❌ Max reconnection attempts reached');
          }
        }
      };

      wsRef.current = ws;
    } catch (error) {
      console.error('Failed to create WebSocket:', error);
      setError(error.message);
      if (onError) onError(error);
    }
  }, [url, autoReconnect, maxRetries, getBackoffDelay, onOpen, onMessage, onError, onClose]);

  // Send message with queuing
  const send = useCallback((message) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      try {
        wsRef.current.send(JSON.stringify(message));
      } catch (e) {
        console.error('Failed to send WebSocket message:', e);
        messageQueueRef.current.push(message);
      }
    } else {
      // Queue message if not connected
      messageQueueRef.current.push(message);
      if (!isConnected && !reconnecting) {
        connect();
      }
    }
  }, [isConnected, reconnecting, connect]);

  // Cleanup on unmount
  useEffect(() => {
    const initialConnect = () => connect();
    initialConnect();

    return () => {
      isManuallyClosedRef.current = true;
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
      }
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [connect]);

  return {
    isConnected,
    error,
    reconnecting,
    send,
    reconnect: () => {
      isManuallyClosedRef.current = false;
      reconnectCountRef.current = 0;
      connect();
    },
    close: () => {
      isManuallyClosedRef.current = true;
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
      }
      if (wsRef.current) {
        wsRef.current.close();
      }
    },
  };
};

export default useWebSocket;

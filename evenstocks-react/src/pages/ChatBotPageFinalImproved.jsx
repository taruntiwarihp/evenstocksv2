/**
 * EXAMPLE: Improved ChatBotPageFinal.jsx with proper error handling
 * Shows WebSocket implementation with exponential backoff and error recovery
 */

import React, { useState, useCallback, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { useNavigate } from 'react-router-dom';
import { useWebSocket } from '../hooks/useWebSocket';
import getConfig from '../config/apiConfig';
import { 
  ErrorAlert, 
  LoadingSpinner, 
  EmptyState, 
  WarningAlert 
} from '../components/LoadingStates';
import '../styles/chatbot-final.css';

const ChatBotPageFinalImproved = () => {
  const { isLoggedIn, user } = useAuth();
  const { isDark } = useTheme();
  const navigate = useNavigate();
  const config = getConfig();

  // State management
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [thinking, setThinking] = useState(false);
  const [thinking Time, setThinkingTime] = useState(0);
  const [streamingContent, setStreamingContent] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [showMentionList, setShowMentionList] = useState(false);
  const [chatHistory, setChatHistory] = useState([]);
  const [toast, setToast] = useState(null);

  // WebSocket with proper error handling
  const {
    isConnected,
    error: wsError,
    reconnecting,
    send: wsSend,
    reconnect,
  } = useWebSocket(`${config.WS_URL}/ws/stock-chat`, {
    onOpen: () => {
      console.log('✅ ChatBot connected');
      showToast('Connected to ChatBot', 'success');
    },
    onMessage: handleWebSocketMessage,
    onError: (error) => {
      console.error('❌ WebSocket error:', error);
      showToast('Connection error. Retrying...', 'warning');
    },
    onClose: () => {
      console.warn('⚠️ ChatBot disconnected');
    },
    autoReconnect: true,
    maxRetries: 5,
  });

  // Handle WebSocket messages
  function handleWebSocketMessage(data) {
    if (!data.type) return;

    switch (data.type) {
      case 'stream_start':
        setThinking(true);
        setStreamingContent('');
        setThinkingTime(0);
        break;

      case 'stream_delta':
        setStreamingContent(prev => prev + (data.content || ''));
        break;

      case 'stream_end':
        setThinking(false);
        if (streamingContent) {
          setMessages(prev => [...prev, {
            type: 'bot',
            content: streamingContent,
            timestamp: new Date(),
          }]);
          saveToHistory();
          setStreamingContent('');
        }
        break;

      case 'error':
        setThinking(false);
        showToast(data.message || 'Error processing your request', 'error');
        setStreamingContent('');
        break;

      default:
        console.warn('Unknown message type:', data.type);
    }
  }

  // Show toast notification
  const showToast = useCallback((message, type = 'info') => {
    setToast({ message, type });
    const timer = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(timer);
  }, []);

  // Search stocks
  const searchStocks = async (query) => {
    if (!query.trim()) return;

    try {
      const response = await fetch(
        `${config.CHATBOT_API}/api/stocks/search?q=${encodeURIComponent(query)}`
      );

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();
      setSearchResults(data.results || []);
    } catch (error) {
      console.error('Search error:', error);
      showToast('Failed to search stocks', 'error');
      setSearchResults([]);
    }
  };

  // Handle stock mention search
  const handleMentionInput = useCallback((text) => {
    const mentionMatch = text.match(/@([a-zA-Z0-9_]*)$/);

    if (mentionMatch) {
      setShowMentionList(true);
      searchStocks(mentionMatch[1]);
    } else {
      setShowMentionList(false);
      setSearchResults([]);
    }
  }, []);

  // Send message
  const handleSendMessage = useCallback(async () => {
    if (!input.trim() || !isConnected) {
      if (!isConnected) {
        showToast('Not connected to ChatBot. Reconnecting...', 'warning');
        reconnect();
      }
      return;
    }

    // Add user message to history
    const userMessage = {
      type: 'user',
      content: input,
      timestamp: new Date(),
    };
    setMessages(prev => [...prev, userMessage]);
    setInput('');

    // Start thinking
    setThinking(true);
    setStreamingContent('');
    setThinkingTime(0);

    // Parse mentions for stock analysis
    const mentions = Array.from(input.matchAll(/@([A-Za-z_][A-Za-z0-9_]*)/g));

    try {
      // Send to WebSocket
      if (mentions.length > 1) {
        wsSend({
          action: 'compare',
          stock_names: mentions.map(m => m[1]),
          content: input,
        });
      } else if (mentions.length === 1) {
        wsSend({
          action: 'analyze',
          stock_name: mentions[0][1],
          content: input,
        });
      } else {
        wsSend({
          action: 'message',
          content: input,
        });
      }
    } catch (error) {
      console.error('Send error:', error);
      showToast('Failed to send message', 'error');
      setThinking(false);
      setMessages(prev => prev.slice(0, -1)); // Remove user message
    }
  }, [input, isConnected, wsSend, reconnect, showToast]);

  // Load chat history from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem('evenstocks_chat_history');
      if (saved) {
        setChatHistory(JSON.parse(saved));
      }
    } catch (error) {
      console.error('Failed to load chat history:', error);
    }
  }, []);

  // Save chat to localStorage
  const saveToHistory = useCallback(() => {
    if (messages.length < 2) return;

    const chatEntry = {
      id: Date.now().toString(),
      title: messages[0]?.content?.substring(0, 50) || 'Chat',
      messages,
      timestamp: new Date(),
    };

    setChatHistory(prev => [chatEntry, ...prev.slice(0, 49)]); // Keep last 50
    localStorage.setItem(
      'evenstocks_chat_history',
      JSON.stringify([chatEntry, ...chatHistory.slice(0, 49)])
    );
  }, [messages, chatHistory]);

  // Keyboard handler
  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  // Redirect if not logged in
  if (!isLoggedIn) {
    return (
      <div className="chatbot-container">
        <ErrorAlert
          message="Please log in to use the ChatBot"
          title="Authentication Required"
          action={() => navigate('/login')}
          actionText="Go to Login"
        />
      </div>
    );
  }

  return (
    <div className={`chatbot-container ${isDark ? 'dark' : ''}`}>
      {/* Connection Status */}
      {wsError && (
        <ErrorAlert
          message={wsError}
          title="Connection Error"
          action={reconnect}
          actionText="Reconnect"
        />
      )}

      {reconnecting && (
        <WarningAlert
          message="Reconnecting to ChatBot..."
          title="Connection Lost"
        />
      )}

      {/* Header */}
      <div className="chatbot-header">
        <h1>
          <i className="fas fa-robot"></i>
          EvenStocks ChatBot
        </h1>
        <div className="header-status">
          {isConnected ? (
            <span className="status online">
              <i className="fas fa-circle"></i> Online
            </span>
          ) : (
            <span className="status offline">
              <i className="fas fa-circle"></i> Offline
            </span>
          )}
        </div>
      </div>

      {/* Messages */}
      <div className="chatbot-messages">
        {messages.length === 0 ? (
          <EmptyState
            icon="fa-comments"
            title="Start a Conversation"
            message="Ask me about stocks, use @SYMBOL to tag stocks for analysis"
          />
        ) : (
          messages.map((msg, idx) => (
            <div
              key={idx}
              className={`message message-${msg.type}`}
            >
              <div className="message-content">
                {msg.content}
              </div>
              <small className="message-time">
                {msg.timestamp?.toLocaleTimeString([], {
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </small>
            </div>
          ))
        )}

        {/* Streaming content */}
        {streamingContent && (
          <div className="message message-bot">
            <div className="message-content">
              {streamingContent}
              <span className="cursor"></span>
            </div>
          </div>
        )}

        {/* Thinking indicator */}
        {thinking && !streamingContent && (
          <div className="message message-bot">
            <LoadingSpinner size="sm" message={`Thinking... ${thinkingTime}s`} />
          </div>
        )}
      </div>

      {/* Input Area */}
      <div className="chatbot-input-area">
        {/* Mention dropdown */}
        {showMentionList && searchResults.length > 0 && (
          <div className="mention-dropdown">
            {searchResults.map((stock, idx) => (
              <button
                key={idx}
                className="mention-item"
                onClick={() => {
                  const newInput = input.replace(/@[a-zA-Z0-9_]*$/, `@${stock.symbol}`);
                  setInput(newInput + ' ');
                  setShowMentionList(false);
                }}
              >
                <strong>{stock.symbol}</strong> - {stock.name}
              </button>
            ))}
          </div>
        )}

        {/* Input */}
        <div className="input-wrapper">
          <textarea
            value={input}
            onChange={(e) => {
              setInput(e.target.value);
              handleMentionInput(e.target.value);
            }}
            onKeyPress={handleKeyPress}
            placeholder="Ask about stocks... (use @SYMBOL for analysis)"
            disabled={!isConnected || thinking}
            rows="3"
          />
          <button
            onClick={handleSendMessage}
            disabled={!isConnected || thinking || !input.trim()}
            className="btn btn-primary send-btn"
            aria-label="Send message"
          >
            <i className="fas fa-paper-plane"></i>
          </button>
        </div>

        {/* Connection message */}
        {!isConnected && (
          <p className="connection-message">
            <i className="fas fa-wifi"></i> Connecting...
          </p>
        )}
      </div>

      {/* Toast Notification */}
      {toast && (
        <div className={`toast toast-${toast.type}`}>
          {toast.message}
        </div>
      )}
    </div>
  );
};

export default ChatBotPageFinalImproved;

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import '../styles/chatbot-enhanced.css';

const ChatBotPageEnhanced = () => {
  const { isLoggedIn, user } = useAuth();
  const navigate = useNavigate();

  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [streaming, setStreaming] = useState(false);
  const [showScrollBtn, setShowScrollBtn] = useState(false);
  const [toast, setToast] = useState('');
  const [activeTab, setActiveTab] = useState('chat');
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [toolkitOpen, setToolkitOpen] = useState(false);
  const [selectedStock, setSelectedStock] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');

  const msgBoxRef = useRef(null);
  const inputRef = useRef(null);

  // Features data
  const features = [
    { id: 'new-chat', icon: '💬', label: 'New Chat' },
    { id: 'search', icon: '🔍', label: 'Search Chat' },
    { id: 'recipe', icon: '📖', label: 'Saved Queries' },
    { id: 'starred', icon: '⭐', label: 'Starred' },
    { id: 'community', icon: '👥', label: 'Community' },
    { id: 'shared', icon: '🔗', label: 'Shared Chats' },
  ];

  const categories = {
    'Market Explorer': {
      icon: '🔍',
      items: ['Screener', 'IPO', 'ETF', 'Bulk/Block Deals', 'Market Movers'],
    },
    'Market Pulse': {
      icon: '📊',
      items: ['Market', 'FII DII Activity', 'Corporate Actions', 'Articles', 'Daily Updates'],
    },
    'Deep Dive': {
      icon: '🔬',
      items: ['Earnings Tracker', 'All Sectors', 'All Industries', 'Sector Analysis'],
    },
    "Investor's Suite": {
      icon: '💼',
      items: ['Dashboard', 'Portfolio', 'Timeline', 'Discovery', 'Watchlists'],
    },
  };

  const deepDiveContent = [
    {
      title: 'Earnings Tracker',
      description: 'Track upcoming earnings, historical performance, and estimates',
      icon: '📈',
    },
    {
      title: 'All Sectors',
      description: 'Comprehensive sector analysis and performance metrics',
      icon: '🏢',
    },
    {
      title: 'All Industries',
      description: 'Industry-wise breakdown and comparisons',
      icon: '🏭',
    },
    {
      title: 'Sector Analysis',
      description: 'In-depth analysis of sector trends and opportunities',
      icon: '📊',
    },
  ];

  const scrollToBottom = useCallback(() => {
    if (msgBoxRef.current) {
      msgBoxRef.current.scrollTop = msgBoxRef.current.scrollHeight;
    }
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  const handleScroll = useCallback(() => {
    if (msgBoxRef.current) {
      const { scrollHeight, scrollTop, clientHeight } = msgBoxRef.current;
      setShowScrollBtn(scrollHeight - scrollTop - clientHeight > 100);
    }
  }, []);

  const showToast = useCallback((msg) => {
    setToast(msg);
    setTimeout(() => setToast(''), 2000);
  }, []);

  const handleSend = () => {
    if (!input.trim()) {
      showToast('Please enter a message');
      return;
    }

    // Add user message
    setMessages((prev) => [...prev, { type: 'user', content: input }]);
    setInput('');
    setStreaming(true);

    // Simulate response
    setTimeout(() => {
      setMessages((prev) => [
        ...prev,
        {
          type: 'bot',
          content: `I received your message: "${input}". Backend API integration coming soon!`,
        },
      ]);
      setStreaming(false);
    }, 1000);
  };

  const handleNewChat = () => {
    setMessages([]);
    setInput('');
    showToast('New chat started');
  };

  const handleCategoryClick = (category, item) => {
    const message = `Show me details about ${category}: ${item}`;
    setInput(message);
  };

  const handleDeepDiveClick = (content) => {
    setInput(`Tell me about ${content.title}`);
  };

  return (
    <div className="chatbot-page-enhanced">
      {/* Sidebar */}
      <aside className={`sidebar ${sidebarOpen ? 'open' : 'closed'}`}>
        <div className="sidebar-header">
          <img src="/assets/img/logo-icon.png" alt="Logo" className="sidebar-logo" />
          <button className="sidebar-toggle" onClick={() => setSidebarOpen(!sidebarOpen)}>
            ☰
          </button>
        </div>

        <nav className="sidebar-nav">
          {features.map((feature) => (
            <button
              key={feature.id}
              className="sidebar-item"
              onClick={() => {
                if (feature.id === 'new-chat') handleNewChat();
              }}
            >
              <span className="sidebar-icon">{feature.icon}</span>
              {sidebarOpen && <span className="sidebar-label">{feature.label}</span>}
            </button>
          ))}
        </nav>

        <div className="sidebar-section">
          <h4>Chat History</h4>
          {messages.length === 0 ? (
            <p className="sidebar-empty">No chats yet</p>
          ) : (
            <div className="chat-history-list">
              {messages
                .filter((m) => m.type === 'user')
                .slice(-5)
                .map((msg, idx) => (
                  <div key={idx} className="history-item">
                    <span>{msg.content.substring(0, 30)}...</span>
                  </div>
                ))}
            </div>
          )}
        </div>

        <div className="sidebar-footer">
          <button className="settings-btn">⚙️ Settings</button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="chatbot-main">
        {/* Top Bar */}
        <div className="chatbot-topbar">
          <div className="topbar-left">
            <input
              type="text"
              className="topbar-search"
              placeholder="Search anything..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            <kbd>Ctrl + K</kbd>
          </div>

          <div className="topbar-nav">
            <button className="nav-item active">Ask Iris</button>
            <button className="nav-item">Dashboard</button>
            <button className="nav-item">Portfolio</button>
            <button className="nav-item">Discovery</button>
            <button className="nav-item">Pricing</button>

            {/* Toolkit Dropdown */}
            <div className="toolkit-dropdown">
              <button className="nav-item" onClick={() => setToolkitOpen(!toolkitOpen)}>
                Toolkit ▼
              </button>
              {toolkitOpen && (
                <div className="toolkit-menu">
                  <div className="toolkit-section">
                    <h4>Deep Dive</h4>
                    {deepDiveContent.map((item, idx) => (
                      <button
                        key={idx}
                        className="toolkit-item"
                        onClick={() => handleDeepDiveClick(item)}
                      >
                        <span className="toolkit-icon">{item.icon}</span>
                        <div>
                          <div className="toolkit-title">{item.title}</div>
                          <div className="toolkit-desc">{item.description}</div>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="topbar-right">
            <button className="theme-btn">🌙</button>
            <button className="user-btn">{user?.username?.[0]?.toUpperCase()}</button>
          </div>
        </div>

        {/* Content Area */}
        <div className="chatbot-content">
          {messages.length === 0 ? (
            <div className="welcome-section">
              <h2>Welcome to Ask Iris</h2>
              <p>Your AI-powered stock research assistant</p>

              {/* Categories Grid */}
              <div className="categories-grid">
                {Object.entries(categories).map(([categoryName, categoryData]) => (
                  <div key={categoryName} className="category-card">
                    <h3>
                      <span className="category-icon">{categoryData.icon}</span>
                      {categoryName}
                    </h3>
                    <div className="category-items">
                      {categoryData.items.map((item, idx) => (
                        <button
                          key={idx}
                          className="category-item-btn"
                          onClick={() => handleCategoryClick(categoryName, item)}
                        >
                          {item}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="chat-messages" ref={msgBoxRef} onScroll={handleScroll}>
              {messages.map((msg, idx) => (
                <div key={idx} className={`message ${msg.type}`}>
                  <div className="message-avatar">
                    {msg.type === 'user' ? '👤' : '🤖'}
                  </div>
                  <div className="message-content">
                    <div className="message-text">{msg.content}</div>
                  </div>
                </div>
              ))}
              {streaming && (
                <div className="message bot">
                  <div className="message-avatar">🤖</div>
                  <div className="message-content">
                    <div className="typing-indicator">
                      <span></span><span></span><span></span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Input Area */}
        <div className="chatbot-input-area">
          <div className="input-wrapper">
            <textarea
              ref={inputRef}
              rows="1"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyPress={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
              placeholder="Ask Iris anything about stocks, markets, or your portfolio..."
              className="chat-input"
            />
            <button
              className="send-btn"
              onClick={handleSend}
              disabled={streaming || !input.trim()}
            >
              {streaming ? '⏳' : '➤'}
            </button>
          </div>
          <div className="input-hint">
            {isLoggedIn ? `Logged in as ${user?.username}` : 'Login to save your queries'}
          </div>
        </div>
      </main>

      {/* Toast */}
      {toast && <div className="toast show">{toast}</div>}

      {/* Scroll to Bottom Button */}
      {showScrollBtn && (
        <button className="scroll-bottom-btn" onClick={scrollToBottom}>
          ↓
        </button>
      )}
    </div>
  );
};

export default ChatBotPageEnhanced;

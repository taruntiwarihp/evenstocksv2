import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import '../styles/chatbot-final.css';

const ChatBotPageFinal = () => {
  const { isLoggedIn, user } = useAuth();
  const navigate = useNavigate();

  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [thinking, setThinking] = useState(false);
  const [thinkingTime, setThinkingTime] = useState(0);
  const [showScrollBtn, setShowScrollBtn] = useState(false);
  const [toast, setToast] = useState('');
  const [toolkitOpen, setToolkitOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [isDarkTheme, setIsDarkTheme] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [showMentionList, setShowMentionList] = useState(false);
  const [mentionQuery, setMentionQuery] = useState('');
  const [mentionResults, setMentionResults] = useState([]);
  const [streamingContent, setStreamingContent] = useState('');
  const [chatHistory, setChatHistory] = useState([]);
  const [activeChatId, setActiveChatId] = useState(null);
  const [historyOpen, setHistoryOpen] = useState(true);
  const [historyMenuId, setHistoryMenuId] = useState(null);

  const msgBoxRef = useRef(null);
  const thinkingTimerRef = useRef(null);
  const textareaRef = useRef(null);
  const wsRef = useRef(null);
  const searchSourceRef = useRef('mention'); // 'mention' or 'topbar'

  // WebSocket connection to Python AI backend
  useEffect(() => {
    const connectWs = () => {
      const ws = new WebSocket('ws://localhost:8000/ws/stock-chat');

      ws.onopen = () => {
        console.log('Connected to EvenStocks AI');
        wsRef.current = ws;
      };

      ws.onmessage = (event) => {
        const data = JSON.parse(event.data);

        if (data.type === 'search_results') {
          // Stock search results from DB
          const results = data.results.map((r) => ({
            symbol: r.stock_name,
            name: r.stock_name.replace(/_/g, ' '),
            price: r.current_price || '',
            pe: r.stock_pe || '',
            market_cap: r.market_cap || '',
          }));
          if (searchSourceRef.current === 'topbar') {
            setSearchResults(results);
          } else {
            setMentionResults(results);
            setShowMentionList(results.length > 0);
          }
        }

        if (data.type === 'stream_start') {
          setStreamingContent('');
          setThinking(true);
        }

        if (data.type === 'stream_delta') {
          setStreamingContent((prev) => prev + data.content);
        }

        if (data.type === 'stream_end') {
          clearInterval(thinkingTimerRef.current);
          setThinking(false);
          setStreamingContent((prev) => {
            if (prev) {
              setMessages((msgs) => {
                const updated = [...msgs, { type: 'bot', content: prev }];
                // Save to chat history after bot responds
                setTimeout(() => saveCurrentChat(updated), 100);
                return updated;
              });
            }
            return '';
          });
        }

        if (data.type === 'error') {
          clearInterval(thinkingTimerRef.current);
          setThinking(false);
          setStreamingContent('');
          setMessages((msgs) => [...msgs, { type: 'bot', content: `Error: ${data.message}` }]);
        }
      };

      ws.onclose = () => {
        wsRef.current = null;
        // Reconnect after 3s
        setTimeout(connectWs, 3000);
      };

      ws.onerror = () => {
        ws.close();
      };
    };

    connectWs();
    return () => { if (wsRef.current) wsRef.current.close(); };
  }, []);

  // Load chat history from localStorage on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem('evenstocks_chat_history');
      if (saved) setChatHistory(JSON.parse(saved));
    } catch (e) {
      console.error('Failed to load chat history:', e);
    }
  }, []);

  // Save chat history to localStorage whenever it changes
  useEffect(() => {
    if (chatHistory.length > 0) {
      localStorage.setItem('evenstocks_chat_history', JSON.stringify(chatHistory));
    }
  }, [chatHistory]);

  // Generate a title from the first user message
  const generateTitle = (msgs) => {
    const firstUser = msgs.find((m) => m.type === 'user');
    if (!firstUser) return 'New Chat';
    const text = firstUser.content.replace(/@\w+/g, '').trim();
    return text.length > 40 ? text.substring(0, 40) + '...' : text || 'Stock Analysis';
  };

  // Save current chat to history (called when bot finishes responding)
  const saveCurrentChat = useCallback((currentMessages) => {
    if (currentMessages.length < 2) return; // need at least 1 user + 1 bot message
    const id = activeChatId || Date.now().toString();
    const title = generateTitle(currentMessages);
    setChatHistory((prev) => {
      const existing = prev.findIndex((h) => h.id === id);
      const entry = {
        id,
        title,
        messages: currentMessages,
        timestamp: Date.now(),
        starred: existing >= 0 ? prev[existing].starred : false,
      };
      if (existing >= 0) {
        const updated = [...prev];
        updated[existing] = entry;
        return updated;
      }
      return [entry, ...prev];
    });
    setActiveChatId(id);
  }, [activeChatId]);

  // Load a chat from history
  const loadChat = (chat) => {
    // Save current chat first if it has content
    if (messages.length >= 2) {
      saveCurrentChat(messages);
    }
    setMessages(chat.messages);
    setActiveChatId(chat.id);
    setStreamingContent('');
    setThinking(false);
    clearInterval(thinkingTimerRef.current);
    setHistoryMenuId(null);
    // Clear backend session and start fresh
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ action: 'clear' }));
    }
  };

  // Delete a chat from history
  const deleteChat = (chatId) => {
    setChatHistory((prev) => {
      const filtered = prev.filter((h) => h.id !== chatId);
      if (filtered.length === 0) {
        localStorage.removeItem('evenstocks_chat_history');
      }
      return filtered;
    });
    if (activeChatId === chatId) {
      setMessages([]);
      setActiveChatId(null);
    }
    setHistoryMenuId(null);
    showToast('Chat deleted');
  };

  // Toggle star on a chat
  const toggleStarChat = (chatId) => {
    setChatHistory((prev) =>
      prev.map((h) => (h.id === chatId ? { ...h, starred: !h.starred } : h))
    );
    setHistoryMenuId(null);
  };

  // Group chat history by date
  const groupedHistory = useCallback(() => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const yesterday = today - 86400000;
    const last7 = today - 7 * 86400000;

    const groups = { Today: [], Yesterday: [], 'Last 7 Days': [], Older: [] };
    chatHistory.forEach((chat) => {
      if (chat.timestamp >= today) groups.Today.push(chat);
      else if (chat.timestamp >= yesterday) groups.Yesterday.push(chat);
      else if (chat.timestamp >= last7) groups['Last 7 Days'].push(chat);
      else groups.Older.push(chat);
    });
    return groups;
  }, [chatHistory]);

  // Sidebar features
  const sidebarItems = [
    { id: 'chat', icon: '📄', label: 'New Chat' },
    { id: 'search', icon: '🔍', label: 'Search Chat' },
    { id: 'starred', icon: '⭐', label: 'Starred Chat' },
    { id: 'community', icon: '👥', label: 'Community Chat' },
    { id: 'share', icon: '🔗', label: 'Shared Chats' },
  ];

  const quickActions = [
    { icon: '👤', label: 'For you' },
    { icon: '📈', label: 'Trending' },
    { icon: '💼', label: 'Portfolio' },
    { icon: '📊', label: 'Stocks' },
    { icon: '🔍', label: 'Screening' },
  ];

  const deepDiveItems = [
    { icon: '📊', title: 'Earnings Tracker', desc: 'Track upcoming earnings releases', action: 'earnings' },
    { icon: '🏭', title: 'All Sectors', desc: 'Explore sector-wise performance', action: 'sectors' },
    { icon: '🏢', title: 'All Industries', desc: 'Industry-wise breakdown analysis', action: 'industries' },
    { icon: '📈', title: 'Sector Analysis', desc: 'In-depth sector analysis & trends', action: 'sector-analysis' },
    { icon: '🔍', title: 'Screener', desc: 'Advanced stock screening tools', action: 'screener' },
    { icon: '🆕', title: 'IPO', desc: 'Upcoming & live IPO details', action: 'ipo' },
    { icon: '💰', title: 'ETF', desc: 'ETF comparison & analysis', action: 'etf' },
    { icon: '📋', title: 'Bulk/Block Deals', desc: 'Large trading transactions', action: 'bulk-deals' },
  ];

  // Render markdown content as formatted JSX
  const renderFormattedContent = (text) => {
    if (!text) return null;

    const lines = text.split('\n');

    return lines.map((line, i) => {
      const trimmed = line.trim();

      // Blank line
      if (trimmed === '') return <br key={i} />;

      // Horizontal rule
      if (/^[-*_]{3,}$/.test(trimmed)) {
        return <hr key={i} style={{ border: 'none', borderTop: '1px solid #ddd', margin: '12px 0' }} />;
      }

      // Headers: # ## ###
      const headerMatch = trimmed.match(/^(#{1,3})\s+(.+)/);
      if (headerMatch) {
        const level = headerMatch[1].length;
        const headerText = headerMatch[2].replace(/\*\*(.*?)\*\*/g, '$1');
        const sizes = { 1: '18px', 2: '16px', 3: '15px' };
        return (
          <div key={i} style={{ fontWeight: 700, fontSize: sizes[level], margin: '14px 0 8px 0', color: '#02634d', borderBottom: level === 1 ? '1px solid #e0e0e0' : 'none', paddingBottom: level === 1 ? '6px' : '0' }}>
            {headerText}
          </div>
        );
      }

      // Apply inline formatting
      let formatted = line.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
      formatted = formatted.replace(/(?<!\*)\*(?!\*)(.*?)(?<!\*)\*(?!\*)/g, '<em>$1</em>');

      // Bullet points: • or - or *
      const isBullet = /^\s*[•\-\*]\s/.test(line);
      if (isBullet) {
        const indent = line.match(/^(\s*)/)[1].length;
        const bulletText = formatted.trim().replace(/^[•\-\*]\s*/, '');
        return (
          <div key={i} className="bot-bullet" style={{ display: 'flex', gap: '8px', padding: '3px 0', marginLeft: `${8 + indent * 8}px` }}>
            <span style={{ color: '#02634d', fontWeight: 600 }}>&#8226;</span>
            <span dangerouslySetInnerHTML={{ __html: bulletText }} />
          </div>
        );
      }

      // Numbered lists: 1. 2. etc
      const numberedMatch = formatted.match(/^(\d+)\.\s+(.*)/);
      if (numberedMatch) {
        return (
          <div key={i} style={{ display: 'flex', gap: '8px', padding: '3px 0', marginLeft: '8px' }}>
            <span style={{ color: '#02634d', fontWeight: 600, minWidth: '18px' }}>{numberedMatch[1]}.</span>
            <span dangerouslySetInnerHTML={{ __html: numberedMatch[2] }} />
          </div>
        );
      }

      // Table rows: | col1 | col2 |
      if (trimmed.startsWith('|') && trimmed.endsWith('|')) {
        // Skip separator rows like |---|---|
        if (/^\|[\s\-:|]+\|$/.test(trimmed)) return null;
        const cells = trimmed.split('|').filter((c) => c.trim() !== '');
        const isHeader = i + 1 < lines.length && /^\|[\s\-:|]+\|$/.test(lines[i + 1]?.trim());
        return (
          <div key={i} style={{ display: 'flex', gap: '4px', padding: '4px 0', fontWeight: isHeader ? 700 : 400, borderBottom: isHeader ? '2px solid #02634d' : '1px solid #eee' }}>
            {cells.map((cell, j) => (
              <span key={j} style={{ flex: 1, padding: '2px 6px', fontSize: '13px' }}
                dangerouslySetInnerHTML={{ __html: cell.trim().replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>') }}
              />
            ))}
          </div>
        );
      }

      // Bold-only lines as sub-headers
      if (formatted.startsWith('<strong>') && formatted.endsWith('</strong>')) {
        return (
          <div key={i} style={{ fontWeight: 700, fontSize: '15px', margin: '10px 0 6px 0', color: '#02634d' }}
            dangerouslySetInnerHTML={{ __html: formatted }}
          />
        );
      }

      // Normal text
      return (
        <div key={i} style={{ padding: '2px 0' }}
          dangerouslySetInnerHTML={{ __html: formatted }}
        />
      );
    });
  };

  // Auto-expand textarea and handle @mentions
  const handleInputChange = (e) => {
    const value = e.target.value;
    setInput(value);

    // Auto-resize textarea
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 120) + 'px';
    }

    // Handle @mentions via WebSocket search
    const lastAtIndex = value.lastIndexOf('@');
    if (lastAtIndex !== -1) {
      const afterAt = value.substring(lastAtIndex + 1);
      // Only show mention list if @ is followed by text without space
      if (!afterAt.includes(' ') && !afterAt.includes('\n')) {
        setMentionQuery(afterAt);
        searchSourceRef.current = 'mention';
        if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
          wsRef.current.send(JSON.stringify({ action: 'search', query: afterAt }));
        }
      } else {
        setShowMentionList(false);
      }
    } else {
      setShowMentionList(false);
    }
  };

  const scrollToBottom = useCallback(() => {
    if (msgBoxRef.current) {
      msgBoxRef.current.scrollTop = msgBoxRef.current.scrollHeight;
    }
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, thinking, streamingContent, scrollToBottom]);

  // Keyboard shortcut for search (Ctrl+K)
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        document.querySelector('.topbar-search-final')?.focus();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (!e.target.closest('.mention-list-final') && !e.target.closest('.input-group-final')) {
        setShowMentionList(false);
      }
      if (!e.target.closest('.search-results-final') && !e.target.closest('.search-container-final')) {
        setSearchResults([]);
      }
      if (!e.target.closest('.toolkit-dropdown-final')) {
        setToolkitOpen(false);
      }
      if (!e.target.closest('.chat-history-item-actions')) {
        setHistoryMenuId(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

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

    const userMsg = input;
    setMessages((prev) => [...prev, { type: 'user', content: userMsg }]);
    setInput('');
    setShowMentionList(false);
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }

    // Start thinking animation
    setThinking(true);
    setStreamingContent('');
    setThinkingTime(0);
    let elapsed = 0;
    thinkingTimerRef.current = setInterval(() => {
      elapsed += 100;
      setThinkingTime((elapsed / 1000).toFixed(2));
    }, 100);

    // Check WebSocket connection
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      clearInterval(thinkingTimerRef.current);
      setThinking(false);
      setMessages((prev) => [
        ...prev,
        {
          type: 'bot',
          content: 'Not connected to AI backend. Please make sure the Python server is running on localhost:8000.',
        },
      ]);
      return;
    }

    // Detect @STOCK mentions → use analyze action for stock-specific queries
    const mentionMatch = userMsg.match(/@([A-Za-z_][A-Za-z0-9_]*)/);
    if (mentionMatch) {
      const stockName = mentionMatch[1];
      wsRef.current.send(
        JSON.stringify({ action: 'analyze', stock_name: stockName })
      );
    } else {
      // General message / follow-up
      wsRef.current.send(
        JSON.stringify({ action: 'message', content: userMsg })
      );
    }
  };

  const handleQuickAction = (label) => {
    setInput(`Tell me about ${label}`);
    textareaRef.current?.focus();
  };

  const handleNewChat = () => {
    // Save current chat before starting new one
    if (messages.length >= 2) {
      saveCurrentChat(messages);
    }
    setMessages([]);
    setInput('');
    setActiveChatId(null);
    setSearchQuery('');
    setSearchResults([]);
    setStreamingContent('');
    setThinking(false);
    clearInterval(thinkingTimerRef.current);
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
    // Clear backend session
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ action: 'clear' }));
    }
    showToast('New chat started');
  };

  const handleSearch = (query) => {
    setSearchQuery(query);
    if (query.trim()) {
      searchSourceRef.current = 'topbar';
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ action: 'search', query }));
      }
    } else {
      setSearchResults([]);
    }
  };

  const handleStockSelect = (stock) => {
    setSearchResults([]);
    setSearchQuery('');
    // Navigate to stock detail page
    navigate(`/stock/${stock.symbol}`);
  };

  const toggleTheme = () => {
    setIsDarkTheme(!isDarkTheme);
  };

  const handleMentionSelect = (stock) => {
    // Replace @query with @SYMBOL + space (space prevents re-trigger)
    const lastAtIndex = input.lastIndexOf('@');
    const beforeAt = input.substring(0, lastAtIndex);
    const newInput = beforeAt + '@' + stock.symbol + ' ';
    setInput(newInput);
    setShowMentionList(false);
    setMentionQuery('');
    setMentionResults([]);
    // Focus back on input and position cursor at end
    setTimeout(() => {
      if (textareaRef.current) {
        textareaRef.current.focus();
        textareaRef.current.selectionStart = newInput.length;
        textareaRef.current.selectionEnd = newInput.length;
      }
    }, 0);
  };

  const handleToolkitAction = (action) => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      showToast('Not connected to AI backend');
      return;
    }

    const prompts = {
      earnings: 'Show me upcoming earnings tracker and recent earnings releases for Indian stocks',
      sectors: 'Give me an overview of all sectors in the Indian stock market with their performance',
      industries: 'Show me industry-wise breakdown and analysis of the Indian market',
      'sector-analysis': 'Provide in-depth sector analysis and trends for the Indian stock market',
      screener: 'Help me screen stocks based on key metrics like PE, ROE, ROCE',
      ipo: 'Show me upcoming and recent IPO details in the Indian market',
      etf: 'Compare and analyze popular ETFs in the Indian market',
      'bulk-deals': 'Show me recent bulk and block deals in the Indian stock market',
    };

    const prompt = prompts[action] || `Tell me about ${action}`;
    setMessages((prev) => [...prev, { type: 'user', content: prompt }]);

    setThinking(true);
    setStreamingContent('');
    setThinkingTime(0);
    let elapsed = 0;
    thinkingTimerRef.current = setInterval(() => {
      elapsed += 100;
      setThinkingTime((elapsed / 1000).toFixed(2));
    }, 100);

    wsRef.current.send(JSON.stringify({ action: 'message', content: prompt }));
  };

  return (
    <div className={`chatbot-page-final ${isDarkTheme ? 'dark-theme' : 'light-theme'}`}>
      {/* Sidebar */}
      <aside className={`sidebar-final ${sidebarOpen ? 'open' : 'closed'}`}>
        <div className="sidebar-header-final">
          <img src="/assets/img/logo-icon.png" alt="EvenStocks" className="sidebar-logo-final" />
          {sidebarOpen && <span className="sidebar-brand-text">EvenStocks</span>}
          <button className="sidebar-toggle-final" onClick={() => setSidebarOpen(!sidebarOpen)}>
            ☰
          </button>
        </div>

        <nav className="sidebar-nav-final">
          {sidebarItems.map((item) => (
            <button
              key={item.id}
              className="sidebar-item-final"
              onClick={() => {
                if (item.id === 'chat') handleNewChat();
                if (item.id === 'starred') {
                  const starred = chatHistory.filter((h) => h.starred);
                  if (starred.length > 0) {
                    showToast(`${starred.length} starred chat(s)`);
                  } else {
                    showToast('No starred chats yet');
                  }
                }
              }}
              title={item.label}
            >
              <span className="sidebar-icon-final">{item.icon}</span>
              {sidebarOpen && <span className="sidebar-label-final">{item.label}</span>}
            </button>
          ))}
        </nav>

        {/* Chat History Section */}
        {sidebarOpen && (
          <div className="chat-history-section">
            <button className="chat-history-toggle" onClick={() => setHistoryOpen(!historyOpen)}>
              <span className="chat-history-title">Chat History</span>
              <span className={`chat-history-arrow ${historyOpen ? 'open' : ''}`}>&#9662;</span>
            </button>

            {historyOpen && (
              <div className="chat-history-list">
                {chatHistory.length === 0 ? (
                  <div className="chat-history-empty">No chat history yet</div>
                ) : (
                  Object.entries(groupedHistory()).map(([group, chats]) =>
                    chats.length > 0 ? (
                      <div key={group} className="chat-history-group">
                        <div className="chat-history-group-label">{group}</div>
                        {chats.map((chat) => (
                          <div
                            key={chat.id}
                            className={`chat-history-item ${activeChatId === chat.id ? 'active' : ''}`}
                          >
                            <button
                              className="chat-history-item-btn"
                              onClick={() => loadChat(chat)}
                              title={chat.title}
                            >
                              {chat.starred && <span className="chat-star-icon">&#9733;</span>}
                              <span className="chat-history-item-title">{chat.title}</span>
                            </button>
                            <div className="chat-history-item-actions">
                              <button
                                className="chat-history-menu-btn"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setHistoryMenuId(historyMenuId === chat.id ? null : chat.id);
                                }}
                              >
                                &#8942;
                              </button>
                              {historyMenuId === chat.id && (
                                <div className="chat-history-menu">
                                  <button onClick={() => toggleStarChat(chat.id)}>
                                    {chat.starred ? '&#9734; Unstar' : '&#9733; Star'}
                                  </button>
                                  <button onClick={() => deleteChat(chat.id)}>
                                    &#128465; Delete
                                  </button>
                                </div>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : null
                  )
                )}
              </div>
            )}
          </div>
        )}

        <div className="sidebar-footer-final">
          <button className="settings-btn-final" title="Settings">
            &#9881; {sidebarOpen && <span>Settings</span>}
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="chatbot-main-final">
        {/* Top Navigation */}
        <div className="topbar-final">
          <div className="topbar-content">
            <div className="topbar-left">
              <div className="search-container-final">
                <input
                  type="text"
                  className="topbar-search-final"
                  placeholder="Search stocks, ETF, IPO..."
                  value={searchQuery}
                  onChange={(e) => handleSearch(e.target.value)}
                />
                {searchResults.length > 0 && (
                  <div className="search-results-final">
                    {searchResults.map((stock, idx) => (
                      <button
                        key={idx}
                        className="search-result-item"
                        onClick={() => handleStockSelect(stock)}
                        title={`${stock.symbol} - ${stock.name}`}
                      >
                        <div style={{ flex: 1 }}>
                          <div className="stock-symbol">{stock.symbol}</div>
                          <div className="stock-name">{stock.name}</div>
                        </div>
                        <div className="stock-price">₹{stock.price}</div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <span className="search-hint">Ctrl + K</span>
            </div>

            <nav className="topbar-nav-final">
              <button className="nav-btn-final active">Ask EvenStocks</button>
              <button className="nav-btn-final" onClick={() => navigate('/dashboard')}>Dashboard</button>
              <button className="nav-btn-final">Portfolio</button>
              <button className="nav-btn-final">Discovery</button>
              <button className="nav-btn-final">Pricing</button>

              <div className="toolkit-dropdown-final">
                <button className="nav-btn-final" onClick={() => setToolkitOpen(!toolkitOpen)}>
                  Toolkit ▼
                </button>
                {toolkitOpen && (
                  <div className="toolkit-menu-final">
                    <h4>📊 Deep Dive Tools</h4>
                    {deepDiveItems.map((item, idx) => (
                      <button
                        key={idx}
                        className="toolkit-item-final"
                        onClick={() => {
                          setToolkitOpen(false);
                          handleToolkitAction(item.action);
                        }}
                      >
                        <div className="toolkit-icon">{item.icon}</div>
                        <div>
                          <div className="toolkit-title-final">{item.title}</div>
                          <div className="toolkit-desc-final">{item.desc}</div>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </nav>

            <div className="topbar-right">
              <button className="theme-btn-final" onClick={toggleTheme} title="Toggle theme">
                {isDarkTheme ? '☀️' : '🌙'}
              </button>
              <button className="user-btn-final">
                {user?.username?.[0]?.toUpperCase() || 'U'}
              </button>
            </div>
          </div>
        </div>

        {/* Chat Area */}
        <div className="chat-container-final">
          {messages.length === 0 ? (
            <div className="welcome-section-final">
              <h1 className="welcome-title-final">
                Welcome to <span className="brand-name">EvenStocks</span>
              </h1>
              <p className="welcome-subtitle">
                Ask anything about stocks, markets, or your portfolio.
              </p>

              {/* Input at top for welcome screen */}
              <div className="input-section-top">
                <div className="input-group-final">
                  <textarea
                    ref={textareaRef}
                    value={input}
                    onChange={handleInputChange}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        handleSend();
                      }
                    }}
                    placeholder="Ask anything about stocks... (Type @ to mention a stock)"
                    className="input-final"
                    rows="1"
                  />
                  <div className="input-actions">
                    <button className="settings-icon-btn">⚙️</button>
                    <button className="send-btn-final" onClick={handleSend}>
                      ➤
                    </button>
                  </div>
                </div>

                {/* @Mention List for welcome screen */}
                {showMentionList && mentionResults.length > 0 && (
                  <div className="mention-list-final">
                    <div className="mention-label">Select Stock</div>
                    {mentionResults.map((stock, idx) => (
                      <button
                        key={idx}
                        className="mention-item-final"
                        onClick={() => handleMentionSelect(stock)}
                      >
                        <div className="mention-symbol">{stock.symbol}</div>
                        <div className="mention-details">
                          <div className="mention-name">{stock.name}</div>
                          <div className="mention-price">₹{stock.price}</div>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Quick Actions */}
              <div className="quick-actions-final">
                {quickActions.map((action, idx) => (
                  <button
                    key={idx}
                    className="quick-action-btn"
                    onClick={() => handleQuickAction(action.label)}
                  >
                    <span className="action-icon">{action.icon}</span>
                    {action.label}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <>
              {/* Chat Messages */}
              <div className="chat-messages-final" ref={msgBoxRef} onScroll={handleScroll}>
                {messages.map((msg, idx) => (
                  <div key={idx} className={`message-wrapper-final ${msg.type}`}>
                    {msg.type === 'user' ? (
                      <div className="user-message-final">
                        <div className="message-bubble-final">{msg.content}</div>
                      </div>
                    ) : (
                      <div className="bot-message-final">
                        <div className="message-bubble-final bot-formatted">
                          {renderFormattedContent(msg.content)}
                        </div>
                      </div>
                    )}
                  </div>
                ))}

                {/* Thinking indicator (before streaming starts) */}
                {thinking && !streamingContent && (
                  <div className="thinking-section-final">
                    <div className="thinking-indicator">
                      <span className="thinking-dot"></span>
                      <span className="thinking-text">Thinking for {thinkingTime}s</span>
                    </div>
                    <div className="thinking-steps">
                      <div className="step">
                        <span className="step-dot active"></span>
                        <span className="step-text">Parsing your query</span>
                      </div>
                      <div className="step">
                        <span className="step-dot"></span>
                        <span className="step-text">Scanning financial databases and documents</span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Streaming AI response (live as tokens arrive) */}
                {streamingContent && (
                  <div className="message-wrapper-final bot">
                    <div className="bot-message-final">
                      <div className="message-bubble-final bot-formatted">
                        {renderFormattedContent(streamingContent)}
                        <span className="streaming-cursor">|</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Input at Bottom for Chat */}
              <div className="input-section-bottom">
                <div className="input-group-final">
                  <textarea
                    ref={textareaRef}
                    value={input}
                    onChange={handleInputChange}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        handleSend();
                      }
                    }}
                    placeholder="Ask EvenStocks anything about stocks... (Type @ to mention a stock)"
                    className="input-final"
                    rows="1"
                    disabled={thinking}
                  />
                  <div className="input-actions">
                    <button className="settings-icon-btn">⚙️</button>
                    <button className="send-btn-final" onClick={handleSend} disabled={thinking}>
                      {thinking ? '⏳' : '➤'}
                    </button>
                  </div>
                </div>

                {/* @Mention List */}
                {showMentionList && mentionResults.length > 0 && (
                  <div className="mention-list-final">
                    <div className="mention-label">Select Stock</div>
                    {mentionResults.map((stock, idx) => (
                      <button
                        key={idx}
                        className="mention-item-final"
                        onClick={() => handleMentionSelect(stock)}
                      >
                        <div className="mention-symbol">{stock.symbol}</div>
                        <div className="mention-details">
                          <div className="mention-name">{stock.name}</div>
                          <div className="mention-price">₹{stock.price}</div>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </main>

      {/* Toast */}
      {toast && <div className="toast-final show">{toast}</div>}

      {/* Scroll Button */}
      {showScrollBtn && (
        <button className="scroll-bottom-btn-final" onClick={scrollToBottom}>
          ↓
        </button>
      )}
    </div>
  );
};

export default ChatBotPageFinal;

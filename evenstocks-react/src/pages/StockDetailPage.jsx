import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTheme } from '../context/ThemeContext';
import '../styles/StockDetail.css';

const API_BASE = 'http://localhost:8000';

const StockDetailPage = () => {
  const { stockName } = useParams();
  const navigate = useNavigate();
  const { isDark: isDarkTheme, toggleTheme } = useTheme();

  const [stockInfo, setStockInfo] = useState(null);
  const [tables, setTables] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('overview');
  const [activeFinancialTab, setActiveFinancialTab] = useState('quarters');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searchOpen, setSearchOpen] = useState(false);
  const [chatInput, setChatInput] = useState('');
  const [chatMentionResults, setChatMentionResults] = useState([]);
  const [showChatMention, setShowChatMention] = useState(false);
  const [showFinancialPercent, setShowFinancialPercent] = useState(false);
  const [expandedFaq, setExpandedFaq] = useState(null);

  const wsRef = useRef(null);
  const chatbarMentionActiveRef = useRef(false);

  const displayName = stockName.replace(/_/g, ' ');

  // Fetch stock data
  useEffect(() => {
    setLoading(true);
    setError('');
    fetch(`${API_BASE}/api/stocks/${stockName}`)
      .then((res) => {
        if (!res.ok) throw new Error('Stock not found');
        return res.json();
      })
      .then((data) => {
        setStockInfo(data.info);
        setTables(data.tables);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  }, [stockName]);

  // WebSocket for search only
  useEffect(() => {
    const connectWs = () => {
      const ws = new WebSocket('ws://localhost:8000/ws/stock-chat');
      ws.onopen = () => { wsRef.current = ws; };
      ws.onmessage = (event) => {
        const data = JSON.parse(event.data);
        if (data.type === 'search_results') {
          const results = data.results.map((r) => ({
            symbol: r.stock_name,
            name: r.stock_name.replace(/_/g, ' '),
            price: r.current_price || '',
          }));
          if (chatbarMentionActiveRef.current) {
            setChatMentionResults(results);
            setShowChatMention(results.length > 0);
          } else {
            setSearchResults(results);
          }
        }
      };
      ws.onclose = () => { wsRef.current = null; setTimeout(connectWs, 3000); };
      ws.onerror = () => { ws.close(); };
    };
    connectWs();
    return () => { if (wsRef.current) wsRef.current.close(); };
  }, []);

  // Keyboard shortcut Ctrl+K
  useEffect(() => {
    const handler = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        setSearchOpen(true);
      }
      if (e.key === 'Escape') {
        setSearchOpen(false);
        setSearchResults([]);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  // Close search on click outside
  useEffect(() => {
    const handler = (e) => {
      if (searchOpen && !e.target.closest('.sd-search-modal') && !e.target.closest('.sd-search-trigger')) {
        setSearchOpen(false);
        setSearchResults([]);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [searchOpen]);

  const handleSearch = (query) => {
    setSearchQuery(query);
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ action: 'search', query: query.trim() }));
    }
    if (!query.trim()) setSearchResults([]);
  };

  const handleSearchSelect = (stock) => {
    setSearchOpen(false);
    setSearchQuery('');
    setSearchResults([]);
    navigate(`/stock/${stock.symbol}`);
  };

  // Parse financial table for display
  const getTableData = useCallback((tableType) => {
    const data = tables[tableType];
    if (!data) return { headers: [], rows: [] };
    let rows = [];
    if (Array.isArray(data) && data.length > 0) {
      if (Array.isArray(data[0])) {
        rows = data[0] || [];
      } else if (typeof data[0] === 'object') {
        rows = data;
      }
    }
    if (rows.length === 0) return { headers: [], rows: [] };
    const headers = Object.keys(rows[0]);
    return { headers, rows: rows.slice(0, 20) };
  }, [tables]);

  // Investment checklist items — expanded
  const getChecklist = () => {
    if (!stockInfo) return [];
    const items = [];
    const pe = parseFloat(stockInfo.stock_pe);
    const roce = parseFloat(stockInfo.roce);
    const roe = parseFloat(stockInfo.roe);
    const divYield = parseFloat(stockInfo.dividend_yield);

    items.push({
      category: 'Performance',
      label: 'Stock Performance',
      value: 'Positive',
      detail: 'Stock return vs Nifty return',
      status: 'good',
    });
    items.push({
      category: 'Valuation',
      label: 'Valuation',
      value: !isNaN(pe) ? (pe < 20 ? 'Undervalued' : pe < 40 ? 'Fairly Valued' : 'Overvalued') : 'N/A',
      detail: `P/E: ${!isNaN(pe) ? pe.toFixed(1) : 'N/A'}`,
      status: !isNaN(pe) ? (pe < 20 ? 'good' : pe < 40 ? 'neutral' : 'bad') : 'neutral',
    });
    items.push({
      category: 'Growth',
      label: 'Revenue Growth',
      value: 'Growing',
      detail: 'YoY Revenue trend',
      status: 'good',
    });
    items.push({
      category: 'Profitability',
      label: 'Profitability',
      value: !isNaN(roce) ? (roce > 20 ? 'High Margin' : roce > 10 ? 'Moderate' : 'Low Margin') : 'N/A',
      detail: `ROCE: ${!isNaN(roce) ? roce + '%' : 'N/A'}`,
      status: !isNaN(roce) ? (roce > 20 ? 'good' : roce > 10 ? 'neutral' : 'bad') : 'neutral',
    });
    items.push({
      category: 'Technicals',
      label: 'Technical Signal',
      value: 'Neutral',
      detail: 'Based on moving averages',
      status: 'neutral',
    });
    items.push({
      category: 'Risk',
      label: 'Risk Assessment',
      value: !isNaN(divYield) ? (divYield > 2 ? 'Low Risk' : divYield > 0.5 ? 'Medium Risk' : 'High Risk') : 'N/A',
      detail: `Div Yield: ${!isNaN(divYield) ? divYield + '%' : 'N/A'}`,
      status: !isNaN(divYield) ? (divYield > 2 ? 'good' : divYield > 0.5 ? 'neutral' : 'bad') : 'neutral',
    });
    return items;
  };

  // Tabs matching multibagg style
  const tabs = [
    { id: 'overview', label: 'Overview' },
    { id: 'technicals', label: 'Technicals' },
    { id: 'forecast', label: 'Forecast' },
    { id: 'peers', label: 'Peers' },
    { id: 'financials', label: 'Financials' },
    { id: 'shareholding', label: 'Shareholdings' },
    { id: 'projection', label: 'Projection' },
    { id: 'documents', label: 'Documents' },
    { id: 'actions', label: 'Actions' },
    { id: 'announcements', label: 'Announcements' },
    { id: 'news', label: 'News' },
    { id: 'articles', label: 'Articles' },
  ];

  const financialTabs = [
    { id: 'quarters', label: 'Quarterly Results' },
    { id: 'profit-loss', label: 'Profit & Loss' },
    { id: 'balance-sheet', label: 'Balance Sheet' },
    { id: 'cash-flow', label: 'Cash Flow' },
    { id: 'ratios', label: 'Ratios' },
  ];

  // Placeholder peer data
  const peerData = [
    { symbol: 'ICICI Bank', price: '1,285.50', marketCap: '8,95,000 Cr', pe: '18.2', pb: '3.1', divYield: '0.8%', roe: '17.5%', roce: '7.2%', roa: '2.1%' },
    { symbol: 'SBI', price: '825.30', marketCap: '7,36,000 Cr', pe: '10.5', pb: '1.8', divYield: '1.7%', roe: '20.1%', roce: '6.8%', roa: '1.0%' },
    { symbol: 'Kotak Bank', price: '1,870.40', marketCap: '3,72,000 Cr', pe: '22.8', pb: '3.5', divYield: '0.1%', roe: '14.2%', roce: '7.5%', roa: '2.3%' },
    { symbol: 'Axis Bank', price: '1,145.20', marketCap: '3,54,000 Cr', pe: '14.3', pb: '2.4', divYield: '0.1%', roe: '18.3%', roce: '7.0%', roa: '1.7%' },
    { symbol: 'IndusInd Bank', price: '1,420.60', marketCap: '1,10,000 Cr', pe: '12.1', pb: '1.9', divYield: '0.9%', roe: '16.0%', roce: '8.1%', roa: '1.8%' },
  ];

  // Placeholder shareholding pattern
  const shareholdingPattern = [
    { holder: 'Promoters', percentage: 0 },
    { holder: 'FII/FPI', percentage: 55.2 },
    { holder: 'DII', percentage: 21.8 },
    { holder: 'Public', percentage: 23.0 },
  ];

  // Placeholder shareholding history
  const shareholdingHistory = [
    { quarter: 'Dec 2025', promoters: '0.00%', fii: '55.20%', dii: '21.80%', public: '23.00%' },
    { quarter: 'Sep 2025', promoters: '0.00%', fii: '54.80%', dii: '22.10%', public: '23.10%' },
    { quarter: 'Jun 2025', promoters: '0.00%', fii: '54.50%', dii: '22.30%', public: '23.20%' },
    { quarter: 'Mar 2025', promoters: '0.00%', fii: '54.10%', dii: '22.60%', public: '23.30%' },
  ];

  // Placeholder documents
  const documents = {
    presentations: [
      { title: 'Q3 FY26 Investor Presentation', date: 'Jan 2026', type: 'PDF' },
      { title: 'Q2 FY26 Investor Presentation', date: 'Oct 2025', type: 'PDF' },
      { title: 'Q1 FY26 Investor Presentation', date: 'Jul 2025', type: 'PDF' },
    ],
    concalls: [
      { title: 'Q3 FY26 Earnings Call Transcript', date: 'Jan 2026', type: 'PDF' },
      { title: 'Q2 FY26 Earnings Call Transcript', date: 'Oct 2025', type: 'PDF' },
    ],
    reports: [
      { title: 'Annual Report 2024-25', date: 'Jun 2025', type: 'PDF' },
      { title: 'Annual Report 2023-24', date: 'Jun 2024', type: 'PDF' },
    ],
  };

  // Placeholder actions (bonus/dividend)
  const actions = {
    bonus: [
      { date: 'Sep 2024', ratio: '1:1', exDate: '19 Sep 2024', recordDate: '19 Sep 2024' },
      { date: 'Sep 2019', ratio: '1:5', exDate: '13 Sep 2019', recordDate: '14 Sep 2019' },
    ],
    dividends: [
      { date: 'May 2025', amount: '19.50', type: 'Final', exDate: '09 May 2025' },
      { date: 'Nov 2024', amount: '19.50', type: 'Interim', exDate: '14 Nov 2024' },
      { date: 'May 2024', amount: '19.00', type: 'Final', exDate: '16 May 2024' },
      { date: 'Nov 2023', amount: '19.00', type: 'Interim', exDate: '16 Nov 2023' },
    ],
  };

  // Placeholder announcements
  const announcements = [
    { title: 'Board Meeting Outcome - Quarterly Results', date: '18 Jan 2026', category: 'Board Meeting' },
    { title: 'Disclosure under Regulation 30 - Analyst Meet', date: '10 Jan 2026', category: 'Disclosure' },
    { title: 'Change in Directors / Key Personnel', date: '02 Jan 2026', category: 'Personnel' },
    { title: 'Credit Rating Update', date: '20 Dec 2025', category: 'Rating' },
    { title: 'Allotment of Equity Shares under ESOP', date: '15 Dec 2025', category: 'ESOP' },
    { title: 'Disclosure of Related Party Transactions', date: '05 Dec 2025', category: 'Disclosure' },
  ];

  // Placeholder news
  const newsItems = [
    { title: `${displayName} reports strong Q3 results, net profit up 15%`, source: 'Economic Times', date: '18 Jan 2026', thumbnail: '' },
    { title: `${displayName} board approves interim dividend of Rs 19.50 per share`, source: 'Moneycontrol', date: '18 Jan 2026', thumbnail: '' },
    { title: `Foreign investors increase stake in ${displayName}`, source: 'LiveMint', date: '15 Jan 2026', thumbnail: '' },
    { title: `${displayName} launches new digital banking platform`, source: 'Business Standard', date: '10 Jan 2026', thumbnail: '' },
    { title: `Analysts bullish on ${displayName} ahead of Q3 results`, source: 'NDTV Profit', date: '05 Jan 2026', thumbnail: '' },
  ];

  // Placeholder articles
  const relatedArticles = [
    { title: `Is ${displayName} a good investment in 2026?`, date: '15 Jan 2026' },
    { title: `${displayName} vs ICICI Bank: Which is the better buy?`, date: '10 Jan 2026' },
    { title: `Complete guide to ${displayName} fundamentals`, date: '05 Jan 2026' },
    { title: `${displayName} dividend history and analysis`, date: '28 Dec 2025' },
    { title: `Technical analysis: ${displayName} price targets for 2026`, date: '20 Dec 2025' },
  ];

  // FAQ
  const faqItems = [
    { q: `What is the current share price of ${displayName}?`, a: `The current share price of ${displayName} is ${stockInfo?.current_price || 'N/A'}. Please note that stock prices are subject to market fluctuations.` },
    { q: `Is ${displayName} a good buy right now?`, a: `Investment decisions should be based on thorough research including fundamental analysis, technical indicators, and your personal risk tolerance. Check the Investment Checklist and Technicals sections above for detailed insights.` },
    { q: `What is the P/E ratio of ${displayName}?`, a: `The P/E ratio of ${displayName} is ${stockInfo?.stock_pe || 'N/A'}. Compare this with industry peers in the Peers section for better context.` },
    { q: `Does ${displayName} pay dividends?`, a: `${displayName} has a dividend yield of ${stockInfo?.dividend_yield || 'N/A'}%. Check the Actions tab for complete dividend history.` },
  ];

  if (loading) {
    return (
      <div className={`sd-page ${isDarkTheme ? 'dark' : 'light'}`}>
        <div className="sd-loading">
          <div className="sd-spinner"></div>
          <p>Loading {displayName}...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`sd-page ${isDarkTheme ? 'dark' : 'light'}`}>
        <div className="sd-error">
          <h2>Stock Not Found</h2>
          <p>{error}</p>
          <button onClick={() => navigate('/')}>Go to Chatbot</button>
        </div>
      </div>
    );
  }

  return (
    <div className={`sd-page ${isDarkTheme ? 'dark' : 'light'}`}>
      {/* Top Bar */}
      <header className="sd-topbar">
        <div className="sd-topbar-left">
          <button className="sd-logo-btn" onClick={() => navigate('/')}>
            <img src="/assets/img/logo-icon.png" alt="ES" className="sd-logo" />
            <span className="sd-logo-text">EvenStocks</span>
          </button>
          <div className="sd-search-trigger" onClick={() => setSearchOpen(true)}>
            <span className="sd-search-icon">&#128269;</span>
            <span className="sd-search-placeholder">Search stocks, ETF, IPO...</span>
            <span className="sd-search-kbd">Ctrl + K</span>
          </div>
        </div>
        <nav className="sd-topbar-nav">
          <button className="sd-nav-btn" onClick={() => navigate('/')}>Ask EvenStocks</button>
          <button className="sd-nav-btn" onClick={() => navigate('/dashboard')}>Dashboard</button>
          <button className="sd-nav-btn">Portfolio</button>
          <button className="sd-nav-btn">Discovery</button>
          <button className="sd-nav-btn">Pricing</button>
        </nav>
        <div className="sd-topbar-right">
          <button className="sd-theme-btn" onClick={toggleTheme}>
            {isDarkTheme ? '\u2600\uFE0F' : '\uD83C\uDF19'}
          </button>
          <button className="sd-user-btn">U</button>
        </div>
      </header>

      {/* Search Overlay */}
      {searchOpen && (
        <div className="sd-search-overlay" onClick={() => { setSearchOpen(false); setSearchResults([]); }}>
          <div className="sd-search-modal" onClick={(e) => e.stopPropagation()}>
            <div className="sd-search-header">
              <span className="sd-search-icon-lg">&#128269;</span>
              <input
                type="text"
                autoFocus
                value={searchQuery}
                onChange={(e) => handleSearch(e.target.value)}
                placeholder="Search stocks, ETF, IPO..."
                className="sd-search-input"
              />
              <button className="sd-search-close" onClick={() => { setSearchOpen(false); setSearchResults([]); setSearchQuery(''); }}>&#10005;</button>
            </div>
            <div className="sd-search-filters">
              <button className="sd-filter-btn active">All</button>
              <button className="sd-filter-btn">Stock</button>
              <button className="sd-filter-btn">ETF</button>
              <button className="sd-filter-btn">Indices</button>
              <button className="sd-filter-btn">IPO</button>
              <button className="sd-filter-btn">Page</button>
            </div>
            <div className="sd-search-results-list">
              {searchResults.length > 0 ? (
                searchResults.map((stock, idx) => (
                  <button key={idx} className="sd-search-result-row" onClick={() => handleSearchSelect(stock)}>
                    <div className="sd-result-icon">
                      <span>{stock.symbol[0]}</span>
                    </div>
                    <div className="sd-result-info">
                      <span className="sd-result-symbol">{stock.symbol.replace(/_/g, ' ').toUpperCase()}</span>
                      <span className="sd-result-name">{stock.name}</span>
                    </div>
                    <span className="sd-result-tag">STOCK</span>
                    <span className="sd-result-action">&#8599;</span>
                  </button>
                ))
              ) : searchQuery ? (
                <div className="sd-no-results">No results found for "{searchQuery}"</div>
              ) : (
                <div className="sd-no-results">Type to search stocks...</div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Breadcrumb */}
      <div className="sd-breadcrumb">
        <button onClick={() => navigate('/')}>Home</button>
        <span>&#8250;</span>
        <button onClick={() => navigate('/')}>All Stocks</button>
        <span>&#8250;</span>
        <span className="sd-breadcrumb-current">{displayName}</span>
      </div>

      {/* Main Content */}
      <main className="sd-main">
        {/* Stock Header Card */}
        <section className="sd-card sd-stock-header">
          <div className="sd-stock-title-row">
            <div className="sd-stock-icon">{stockName[0]}</div>
            <div className="sd-stock-title-info">
              <h1 className="sd-stock-name">{displayName}</h1>
              <div className="sd-stock-badges">
                <span className="sd-stock-symbol">{stockName.toUpperCase()}</span>
                <span className="sd-badge sd-badge-exchange">NSE</span>
                <span className="sd-badge sd-badge-sector">Banking</span>
              </div>
            </div>
            <div className="sd-stock-actions">
              <button className="sd-watchlist-btn"><i className="bi bi-bookmark"></i> Watchlist</button>
              <button className="sd-share-btn"><i className="bi bi-share"></i></button>
            </div>
          </div>

          <div className="sd-price-row">
            <div className="sd-price-block">
              <span className="sd-price">{stockInfo.current_price ? `\u20B9${stockInfo.current_price}` : 'N/A'}</span>
              <span className="sd-price-change positive">+12.50 (0.72%)</span>
            </div>
            <div className="sd-price-meta">
              <div className="sd-meta-item">
                <span className="sd-meta-label">Market Cap</span>
                <span className="sd-meta-value">{stockInfo.market_cap || 'N/A'}</span>
              </div>
              <div className="sd-meta-item">
                <span className="sd-meta-label">P/E Ratio</span>
                <span className="sd-meta-value">{stockInfo.stock_pe || 'N/A'}</span>
              </div>
              <div className="sd-meta-item">
                <span className="sd-meta-label">Book Value</span>
                <span className="sd-meta-value">{stockInfo.book_value || 'N/A'}</span>
              </div>
              <div className="sd-meta-item">
                <span className="sd-meta-label">Dividend Yield</span>
                <span className="sd-meta-value">{stockInfo.dividend_yield ? stockInfo.dividend_yield + '%' : 'N/A'}</span>
              </div>
              <div className="sd-meta-item">
                <span className="sd-meta-label">ROCE</span>
                <span className="sd-meta-value">{stockInfo.roce ? stockInfo.roce + '%' : 'N/A'}</span>
              </div>
              <div className="sd-meta-item">
                <span className="sd-meta-label">ROE</span>
                <span className="sd-meta-value">{stockInfo.roe ? stockInfo.roe + '%' : 'N/A'}</span>
              </div>
            </div>
          </div>

          {/* 52 Week Range Bar */}
          <div className="sd-range-bar">
            <div className="sd-range-labels">
              <span>52W Low: {stockInfo.high_low ? stockInfo.high_low.split('/')[1]?.trim() || 'N/A' : 'N/A'}</span>
              <span>52W High: {stockInfo.high_low ? stockInfo.high_low.split('/')[0]?.trim() || 'N/A' : 'N/A'}</span>
            </div>
            <div className="sd-range-track">
              <div className="sd-range-fill" style={{ width: '65%' }}></div>
              <div className="sd-range-marker" style={{ left: '65%' }}></div>
            </div>
          </div>
        </section>

        {/* Investment Checklist */}
        <section className="sd-card">
          <div className="sd-section-header">
            <h3 className="sd-section-title">Investment Checklist</h3>
            <span className="sd-section-subtitle">Quick assessment based on key parameters</span>
          </div>
          <div className="sd-checklist-grid">
            {getChecklist().map((item, idx) => (
              <div key={idx} className={`sd-checklist-card ${item.status}`}>
                <div className="sd-checklist-top">
                  <span className={`sd-checklist-dot ${item.status}`}></span>
                  <span className="sd-checklist-category">{item.category}</span>
                </div>
                <span className="sd-checklist-value">{item.value}</span>
                <span className="sd-checklist-detail">{item.detail}</span>
              </div>
            ))}
          </div>
        </section>

        {/* Key Metrics Card */}
        <section className="sd-card">
          <h3 className="sd-section-title">Key Metrics</h3>
          <div className="sd-metrics-grid">
            {[
              { label: 'ROCE', value: stockInfo.roce ? stockInfo.roce + '%' : 'N/A' },
              { label: 'ROE', value: stockInfo.roe ? stockInfo.roe + '%' : 'N/A' },
              { label: 'P/E Ratio', value: stockInfo.stock_pe || 'N/A' },
              { label: 'P/B Ratio', value: stockInfo.book_value ? (parseFloat(stockInfo.current_price) / parseFloat(stockInfo.book_value)).toFixed(2) : 'N/A' },
              { label: 'Div Yield', value: stockInfo.dividend_yield ? stockInfo.dividend_yield + '%' : 'N/A' },
              { label: 'Face Value', value: stockInfo.face_value || 'N/A' },
              { label: 'Book Value', value: stockInfo.book_value || 'N/A' },
              { label: '52W High/Low', value: stockInfo.high_low || 'N/A' },
            ].map((m, idx) => (
              <div key={idx} className="sd-metric-card">
                <span className="sd-metric-label">{m.label}</span>
                <span className="sd-metric-value">{m.value}</span>
              </div>
            ))}
          </div>
        </section>

        {/* Chart Placeholder */}
        <section className="sd-card">
          <div className="sd-section-header">
            <h3 className="sd-section-title">Price Chart</h3>
            <div className="sd-chart-timeframes">
              {['1D', '1W', '1M', '3M', '6M', '1Y', '3Y', '5Y', 'MAX'].map((tf) => (
                <button key={tf} className="sd-timeframe-btn">{tf}</button>
              ))}
            </div>
          </div>
          <div className="sd-chart-placeholder">
            <div className="sd-chart-placeholder-inner">
              <i className="bi bi-graph-up"></i>
              <p>Price chart will be displayed here</p>
            </div>
          </div>
        </section>

        {/* Main Tabs Navigation */}
        <div className="sd-tabs">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              className={`sd-tab ${activeTab === tab.id ? 'active' : ''}`}
              onClick={() => setActiveTab(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* ===================== TAB CONTENT ===================== */}

        {/* OVERVIEW TAB */}
        {activeTab === 'overview' && (
          <div className="sd-tab-content">
            {/* About */}
            <section className="sd-card">
              <h3 className="sd-section-title">About {displayName}</h3>
              <p className="sd-about-text">{stockInfo.about || 'No description available for this stock. The company overview will appear here once data is available.'}</p>
            </section>

            {/* Pros & Cons */}
            <div className="sd-pros-cons-grid">
              <div className="sd-card sd-pros-section">
                <h3 className="sd-section-title sd-pros-title">Strengths</h3>
                {Array.isArray(stockInfo.pros) && stockInfo.pros.length > 0 ? (
                  <ul className="sd-pros-list">
                    {stockInfo.pros.map((p, i) => (
                      <li key={i}><span className="sd-pro-icon">&#10003;</span>{p}</li>
                    ))}
                  </ul>
                ) : (
                  <p className="sd-no-data">No strengths data available</p>
                )}
              </div>
              <div className="sd-card sd-cons-section">
                <h3 className="sd-section-title sd-cons-title">Weaknesses</h3>
                {Array.isArray(stockInfo.cons) && stockInfo.cons.length > 0 ? (
                  <ul className="sd-cons-list">
                    {stockInfo.cons.map((c, i) => (
                      <li key={i}><span className="sd-con-icon">&#10007;</span>{c}</li>
                    ))}
                  </ul>
                ) : (
                  <p className="sd-no-data">No weaknesses data available</p>
                )}
              </div>
            </div>

            {/* Stock Info Grid */}
            <section className="sd-card">
              <h3 className="sd-section-title">Stock Information</h3>
              <div className="sd-info-grid">
                {[
                  { label: 'Market Cap', value: stockInfo.market_cap || 'N/A' },
                  { label: 'Current Price', value: stockInfo.current_price ? `\u20B9${stockInfo.current_price}` : 'N/A' },
                  { label: 'High / Low', value: stockInfo.high_low || 'N/A' },
                  { label: 'Stock P/E', value: stockInfo.stock_pe || 'N/A' },
                  { label: 'Book Value', value: stockInfo.book_value || 'N/A' },
                  { label: 'Dividend Yield', value: stockInfo.dividend_yield ? stockInfo.dividend_yield + '%' : 'N/A' },
                  { label: 'ROCE', value: stockInfo.roce ? stockInfo.roce + '%' : 'N/A' },
                  { label: 'ROE', value: stockInfo.roe ? stockInfo.roe + '%' : 'N/A' },
                  { label: 'Face Value', value: stockInfo.face_value || 'N/A' },
                ].map((item, idx) => (
                  <div key={idx} className="sd-info-row">
                    <span className="sd-info-label">{item.label}</span>
                    <span className="sd-info-value">{item.value}</span>
                  </div>
                ))}
              </div>
            </section>
          </div>
        )}

        {/* TECHNICALS TAB */}
        {activeTab === 'technicals' && (
          <div className="sd-tab-content">
            <section className="sd-card">
              <h3 className="sd-section-title">Technical Analysis</h3>
              <div className="sd-technicals-grid">
                {/* Oscillators */}
                <div className="sd-technical-card">
                  <h4 className="sd-technical-title">Oscillators</h4>
                  <div className="sd-gauge-placeholder">
                    <div className="sd-gauge-circle">
                      <span className="sd-gauge-label">Neutral</span>
                    </div>
                  </div>
                  <div className="sd-signal-counts">
                    <span className="sd-signal sell">Sell: 2</span>
                    <span className="sd-signal neutral">Neutral: 6</span>
                    <span className="sd-signal buy">Buy: 3</span>
                  </div>
                </div>

                {/* Overall */}
                <div className="sd-technical-card">
                  <h4 className="sd-technical-title">Overall</h4>
                  <div className="sd-gauge-placeholder">
                    <div className="sd-gauge-circle">
                      <span className="sd-gauge-label">Neutral</span>
                    </div>
                  </div>
                  <div className="sd-signal-counts">
                    <span className="sd-signal sell">Sell: 5</span>
                    <span className="sd-signal neutral">Neutral: 9</span>
                    <span className="sd-signal buy">Buy: 12</span>
                  </div>
                </div>

                {/* Moving Averages */}
                <div className="sd-technical-card">
                  <h4 className="sd-technical-title">Moving Averages</h4>
                  <div className="sd-gauge-placeholder">
                    <div className="sd-gauge-circle">
                      <span className="sd-gauge-label">Buy</span>
                    </div>
                  </div>
                  <div className="sd-signal-counts">
                    <span className="sd-signal sell">Sell: 3</span>
                    <span className="sd-signal neutral">Neutral: 1</span>
                    <span className="sd-signal buy">Buy: 11</span>
                  </div>
                </div>
              </div>
            </section>

            {/* Technical Indicators Table */}
            <section className="sd-card">
              <h3 className="sd-section-title">Technical Indicators</h3>
              <div className="sd-table-wrapper">
                <table className="sd-table">
                  <thead>
                    <tr>
                      <th>Indicator</th>
                      <th>Value</th>
                      <th>Signal</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      { name: 'RSI (14)', value: '55.42', signal: 'Neutral' },
                      { name: 'MACD (12,26,9)', value: '8.25', signal: 'Buy' },
                      { name: 'Stochastic (14,3,3)', value: '68.50', signal: 'Neutral' },
                      { name: 'CCI (14)', value: '45.20', signal: 'Neutral' },
                      { name: 'ADX (14)', value: '22.30', signal: 'Neutral' },
                      { name: 'Williams %R', value: '-32.50', signal: 'Buy' },
                      { name: 'ATR (14)', value: '28.75', signal: '-' },
                      { name: 'Bull/Bear Power', value: '15.60', signal: 'Buy' },
                    ].map((ind, idx) => (
                      <tr key={idx}>
                        <td>{ind.name}</td>
                        <td>{ind.value}</td>
                        <td>
                          <span className={`sd-signal-badge ${ind.signal.toLowerCase()}`}>{ind.signal}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            {/* Moving Averages Table */}
            <section className="sd-card">
              <h3 className="sd-section-title">Moving Averages</h3>
              <div className="sd-table-wrapper">
                <table className="sd-table">
                  <thead>
                    <tr>
                      <th>Period</th>
                      <th>Simple</th>
                      <th>Exponential</th>
                      <th>Signal</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      { period: 'MA5', simple: '1,745.20', exp: '1,748.30', signal: 'Buy' },
                      { period: 'MA10', simple: '1,738.50', exp: '1,740.10', signal: 'Buy' },
                      { period: 'MA20', simple: '1,725.80', exp: '1,730.40', signal: 'Buy' },
                      { period: 'MA50', simple: '1,698.20', exp: '1,710.50', signal: 'Buy' },
                      { period: 'MA100', simple: '1,650.40', exp: '1,672.30', signal: 'Buy' },
                      { period: 'MA200', simple: '1,580.60', exp: '1,620.80', signal: 'Buy' },
                    ].map((ma, idx) => (
                      <tr key={idx}>
                        <td>{ma.period}</td>
                        <td>{ma.simple}</td>
                        <td>{ma.exp}</td>
                        <td>
                          <span className={`sd-signal-badge ${ma.signal.toLowerCase()}`}>{ma.signal}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          </div>
        )}

        {/* FORECAST TAB */}
        {activeTab === 'forecast' && (
          <div className="sd-tab-content">
            <section className="sd-card">
              <h3 className="sd-section-title">Price Forecast</h3>
              <div className="sd-forecast-grid">
                <div className="sd-forecast-card">
                  <span className="sd-forecast-period">1 Month</span>
                  <span className="sd-forecast-target positive">+2.5%</span>
                  <span className="sd-forecast-price">Target: {stockInfo.current_price ? `\u20B9${(parseFloat(stockInfo.current_price) * 1.025).toFixed(2)}` : 'N/A'}</span>
                </div>
                <div className="sd-forecast-card">
                  <span className="sd-forecast-period">3 Months</span>
                  <span className="sd-forecast-target positive">+5.8%</span>
                  <span className="sd-forecast-price">Target: {stockInfo.current_price ? `\u20B9${(parseFloat(stockInfo.current_price) * 1.058).toFixed(2)}` : 'N/A'}</span>
                </div>
                <div className="sd-forecast-card">
                  <span className="sd-forecast-period">6 Months</span>
                  <span className="sd-forecast-target positive">+12.3%</span>
                  <span className="sd-forecast-price">Target: {stockInfo.current_price ? `\u20B9${(parseFloat(stockInfo.current_price) * 1.123).toFixed(2)}` : 'N/A'}</span>
                </div>
                <div className="sd-forecast-card">
                  <span className="sd-forecast-period">1 Year</span>
                  <span className="sd-forecast-target positive">+18.7%</span>
                  <span className="sd-forecast-price">Target: {stockInfo.current_price ? `\u20B9${(parseFloat(stockInfo.current_price) * 1.187).toFixed(2)}` : 'N/A'}</span>
                </div>
              </div>
            </section>

            {/* Analyst Recommendations */}
            <section className="sd-card">
              <h3 className="sd-section-title">Analyst Recommendations</h3>
              <div className="sd-analyst-summary">
                <div className="sd-analyst-bar">
                  <div className="sd-analyst-segment strong-buy" style={{ width: '35%' }}><span>Strong Buy</span></div>
                  <div className="sd-analyst-segment buy" style={{ width: '30%' }}><span>Buy</span></div>
                  <div className="sd-analyst-segment hold" style={{ width: '20%' }}><span>Hold</span></div>
                  <div className="sd-analyst-segment sell" style={{ width: '10%' }}><span>Sell</span></div>
                  <div className="sd-analyst-segment strong-sell" style={{ width: '5%' }}><span>Strong Sell</span></div>
                </div>
                <div className="sd-analyst-counts">
                  <span>Strong Buy: 14</span>
                  <span>Buy: 12</span>
                  <span>Hold: 8</span>
                  <span>Sell: 4</span>
                  <span>Strong Sell: 2</span>
                </div>
              </div>
            </section>

            {/* Forecast Chart Placeholder */}
            <section className="sd-card">
              <h3 className="sd-section-title">Price Forecast Chart</h3>
              <div className="sd-chart-placeholder">
                <div className="sd-chart-placeholder-inner">
                  <i className="bi bi-graph-up-arrow"></i>
                  <p>Forecast chart with confidence intervals will be displayed here</p>
                </div>
              </div>
            </section>
          </div>
        )}

        {/* PEERS TAB */}
        {activeTab === 'peers' && (
          <div className="sd-tab-content">
            <section className="sd-card">
              <h3 className="sd-section-title">Peer Comparison</h3>
              <div className="sd-table-wrapper">
                <table className="sd-table">
                  <thead>
                    <tr>
                      <th>Company</th>
                      <th>Price</th>
                      <th>Market Cap</th>
                      <th>P/E</th>
                      <th>P/B</th>
                      <th>Div Yield</th>
                      <th>ROE</th>
                      <th>ROCE</th>
                      <th>ROA</th>
                    </tr>
                  </thead>
                  <tbody>
                    {/* Current stock row */}
                    <tr className="sd-peer-current">
                      <td><strong>{displayName}</strong></td>
                      <td>{stockInfo.current_price || 'N/A'}</td>
                      <td>{stockInfo.market_cap || 'N/A'}</td>
                      <td>{stockInfo.stock_pe || 'N/A'}</td>
                      <td>{stockInfo.book_value ? (parseFloat(stockInfo.current_price) / parseFloat(stockInfo.book_value)).toFixed(2) : 'N/A'}</td>
                      <td>{stockInfo.dividend_yield ? stockInfo.dividend_yield + '%' : 'N/A'}</td>
                      <td>{stockInfo.roe ? stockInfo.roe + '%' : 'N/A'}</td>
                      <td>{stockInfo.roce ? stockInfo.roce + '%' : 'N/A'}</td>
                      <td>N/A</td>
                    </tr>
                    {peerData.map((peer, idx) => (
                      <tr key={idx}>
                        <td>{peer.symbol}</td>
                        <td>{peer.price}</td>
                        <td>{peer.marketCap}</td>
                        <td>{peer.pe}</td>
                        <td>{peer.pb}</td>
                        <td>{peer.divYield}</td>
                        <td>{peer.roe}</td>
                        <td>{peer.roce}</td>
                        <td>{peer.roa}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            {/* Price Chart Comparison Placeholder */}
            <section className="sd-card">
              <h3 className="sd-section-title">Price Chart Comparison</h3>
              <div className="sd-chart-placeholder">
                <div className="sd-chart-placeholder-inner">
                  <i className="bi bi-bar-chart-line"></i>
                  <p>Peer price comparison chart will be displayed here</p>
                </div>
              </div>
            </section>
          </div>
        )}

        {/* FINANCIALS TAB */}
        {activeTab === 'financials' && (
          <div className="sd-tab-content">
            <section className="sd-card">
              <div className="sd-financial-header">
                <div className="sd-financial-tabs">
                  {financialTabs.map((ft) => (
                    <button
                      key={ft.id}
                      className={`sd-fin-tab ${activeFinancialTab === ft.id ? 'active' : ''}`}
                      onClick={() => setActiveFinancialTab(ft.id)}
                    >
                      {ft.label}
                    </button>
                  ))}
                </div>
                <div className="sd-financial-toggles">
                  <button
                    className={`sd-toggle-btn ${!showFinancialPercent ? 'active' : ''}`}
                    onClick={() => setShowFinancialPercent(false)}
                  >
                    Total Figures
                  </button>
                  <button
                    className={`sd-toggle-btn ${showFinancialPercent ? 'active' : ''}`}
                    onClick={() => setShowFinancialPercent(true)}
                  >
                    % Changes
                  </button>
                  <button className="sd-toggle-btn">View Standalone</button>
                </div>
              </div>

              {(() => {
                const { headers, rows } = getTableData(activeFinancialTab);
                if (rows.length === 0) {
                  return <div className="sd-no-data">No {activeFinancialTab} data available</div>;
                }
                return (
                  <div className="sd-table-wrapper">
                    <table className="sd-table">
                      <thead>
                        <tr>
                          {headers.map((h, i) => (
                            <th key={i}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {rows.map((row, i) => (
                          <tr key={i}>
                            {headers.map((h, j) => (
                              <td key={j}>{row[h] ?? ''}</td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                );
              })()}
            </section>
          </div>
        )}

        {/* SHAREHOLDINGS TAB */}
        {activeTab === 'shareholding' && (
          <div className="sd-tab-content">
            {/* Shareholding Pattern Visual */}
            <section className="sd-card">
              <h3 className="sd-section-title">Shareholding Pattern</h3>
              <div className="sd-shareholding-visual">
                <div className="sd-pie-placeholder">
                  <div className="sd-pie-circle">
                    <p>Pie Chart</p>
                    <p className="sd-pie-sub">Chart placeholder</p>
                  </div>
                </div>
                <div className="sd-shareholding-legend">
                  {shareholdingPattern.map((item, idx) => (
                    <div key={idx} className="sd-legend-item">
                      <span className={`sd-legend-dot color-${idx}`}></span>
                      <span className="sd-legend-label">{item.holder}</span>
                      <span className="sd-legend-value">{item.percentage}%</span>
                    </div>
                  ))}
                </div>
              </div>
            </section>

            {/* Shareholding History */}
            <section className="sd-card">
              <h3 className="sd-section-title">Shareholding History (Quarterly)</h3>
              <div className="sd-table-wrapper">
                <table className="sd-table">
                  <thead>
                    <tr>
                      <th>Quarter</th>
                      <th>Promoters</th>
                      <th>FII/FPI</th>
                      <th>DII</th>
                      <th>Public</th>
                    </tr>
                  </thead>
                  <tbody>
                    {shareholdingHistory.map((row, idx) => (
                      <tr key={idx}>
                        <td>{row.quarter}</td>
                        <td>{row.promoters}</td>
                        <td>{row.fii}</td>
                        <td>{row.dii}</td>
                        <td>{row.public}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            {/* Actual shareholding data from API */}
            {(() => {
              const { headers, rows } = getTableData('shareholding');
              if (rows.length === 0) return null;
              return (
                <section className="sd-card">
                  <h3 className="sd-section-title">Detailed Shareholding Data</h3>
                  <div className="sd-table-wrapper">
                    <table className="sd-table">
                      <thead>
                        <tr>
                          {headers.map((h, i) => (
                            <th key={i}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {rows.map((row, i) => (
                          <tr key={i}>
                            {headers.map((h, j) => (
                              <td key={j}>{row[h] ?? ''}</td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </section>
              );
            })()}

            {/* Shareholding Chart Placeholder */}
            <section className="sd-card">
              <h3 className="sd-section-title">Shareholding Trend</h3>
              <div className="sd-chart-placeholder">
                <div className="sd-chart-placeholder-inner">
                  <i className="bi bi-pie-chart"></i>
                  <p>Shareholding trend chart will be displayed here</p>
                </div>
              </div>
            </section>
          </div>
        )}

        {/* PROJECTION TAB */}
        {activeTab === 'projection' && (
          <div className="sd-tab-content">
            <section className="sd-card">
              <h3 className="sd-section-title">Revenue & Profit Projection</h3>
              <div className="sd-chart-placeholder sd-chart-tall">
                <div className="sd-chart-placeholder-inner">
                  <i className="bi bi-graph-up-arrow"></i>
                  <p>Revenue and profit projection chart will be displayed here</p>
                </div>
              </div>
            </section>
            <section className="sd-card">
              <h3 className="sd-section-title">EPS Projection</h3>
              <div className="sd-chart-placeholder">
                <div className="sd-chart-placeholder-inner">
                  <i className="bi bi-graph-up"></i>
                  <p>EPS projection chart will be displayed here</p>
                </div>
              </div>
            </section>
            <section className="sd-card">
              <h3 className="sd-section-title">Target Price Estimates</h3>
              <div className="sd-projection-table">
                <div className="sd-table-wrapper">
                  <table className="sd-table">
                    <thead>
                      <tr>
                        <th>Analyst Firm</th>
                        <th>Target Price</th>
                        <th>Recommendation</th>
                        <th>Date</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[
                        { firm: 'Morgan Stanley', target: '2,050', rec: 'Overweight', date: 'Jan 2026' },
                        { firm: 'Goldman Sachs', target: '1,980', rec: 'Buy', date: 'Jan 2026' },
                        { firm: 'JP Morgan', target: '1,900', rec: 'Overweight', date: 'Dec 2025' },
                        { firm: 'CLSA', target: '1,850', rec: 'Buy', date: 'Dec 2025' },
                        { firm: 'Motilal Oswal', target: '2,100', rec: 'Buy', date: 'Jan 2026' },
                      ].map((row, idx) => (
                        <tr key={idx}>
                          <td>{row.firm}</td>
                          <td>{'\u20B9'}{row.target}</td>
                          <td><span className="sd-signal-badge buy">{row.rec}</span></td>
                          <td>{row.date}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </section>
          </div>
        )}

        {/* DOCUMENTS TAB */}
        {activeTab === 'documents' && (
          <div className="sd-tab-content">
            {/* Presentations */}
            <section className="sd-card">
              <h3 className="sd-section-title">Investor Presentations</h3>
              <div className="sd-documents-grid">
                {documents.presentations.map((doc, idx) => (
                  <div key={idx} className="sd-document-card">
                    <div className="sd-doc-icon"><i className="bi bi-file-earmark-pdf"></i></div>
                    <div className="sd-doc-info">
                      <span className="sd-doc-title">{doc.title}</span>
                      <span className="sd-doc-date">{doc.date}</span>
                    </div>
                    <span className="sd-doc-type">{doc.type}</span>
                  </div>
                ))}
              </div>
            </section>

            {/* Concalls */}
            <section className="sd-card">
              <h3 className="sd-section-title">Concall Transcripts</h3>
              <div className="sd-documents-grid">
                {documents.concalls.map((doc, idx) => (
                  <div key={idx} className="sd-document-card">
                    <div className="sd-doc-icon"><i className="bi bi-file-earmark-text"></i></div>
                    <div className="sd-doc-info">
                      <span className="sd-doc-title">{doc.title}</span>
                      <span className="sd-doc-date">{doc.date}</span>
                    </div>
                    <span className="sd-doc-type">{doc.type}</span>
                  </div>
                ))}
              </div>
            </section>

            {/* Annual Reports */}
            <section className="sd-card">
              <h3 className="sd-section-title">Annual Reports</h3>
              <div className="sd-documents-grid">
                {documents.reports.map((doc, idx) => (
                  <div key={idx} className="sd-document-card">
                    <div className="sd-doc-icon"><i className="bi bi-file-earmark-bar-graph"></i></div>
                    <div className="sd-doc-info">
                      <span className="sd-doc-title">{doc.title}</span>
                      <span className="sd-doc-date">{doc.date}</span>
                    </div>
                    <span className="sd-doc-type">{doc.type}</span>
                  </div>
                ))}
              </div>
            </section>
          </div>
        )}

        {/* ACTIONS TAB */}
        {activeTab === 'actions' && (
          <div className="sd-tab-content">
            {/* Bonus History */}
            <section className="sd-card">
              <h3 className="sd-section-title">Bonus History</h3>
              <div className="sd-actions-grid">
                {actions.bonus.map((item, idx) => (
                  <div key={idx} className="sd-action-card">
                    <div className="sd-action-badge bonus">BONUS</div>
                    <div className="sd-action-info">
                      <span className="sd-action-ratio">Ratio: {item.ratio}</span>
                      <span className="sd-action-date">Ex-Date: {item.exDate}</span>
                      <span className="sd-action-date">Record Date: {item.recordDate}</span>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            {/* Dividend History */}
            <section className="sd-card">
              <h3 className="sd-section-title">Dividend History</h3>
              <div className="sd-table-wrapper">
                <table className="sd-table">
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Type</th>
                      <th>Amount ({'\u20B9'})</th>
                      <th>Ex-Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {actions.dividends.map((div, idx) => (
                      <tr key={idx}>
                        <td>{div.date}</td>
                        <td><span className="sd-dividend-type">{div.type}</span></td>
                        <td>{'\u20B9'}{div.amount}</td>
                        <td>{div.exDate}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            {/* Dividend Trend Chart Placeholder */}
            <section className="sd-card">
              <h3 className="sd-section-title">Dividend Trend</h3>
              <div className="sd-chart-placeholder">
                <div className="sd-chart-placeholder-inner">
                  <i className="bi bi-bar-chart"></i>
                  <p>Dividend trend chart will be displayed here</p>
                </div>
              </div>
            </section>
          </div>
        )}

        {/* ANNOUNCEMENTS TAB */}
        {activeTab === 'announcements' && (
          <div className="sd-tab-content">
            <section className="sd-card">
              <h3 className="sd-section-title">Recent Announcements</h3>
              <div className="sd-announcements-list">
                {announcements.map((ann, idx) => (
                  <div key={idx} className="sd-announcement-card">
                    <div className="sd-announcement-date">
                      <span className="sd-ann-day">{ann.date.split(' ')[0]}</span>
                      <span className="sd-ann-month">{ann.date.split(' ')[1]} {ann.date.split(' ')[2]}</span>
                    </div>
                    <div className="sd-announcement-info">
                      <span className="sd-ann-title">{ann.title}</span>
                      <span className="sd-ann-category">{ann.category}</span>
                    </div>
                    <span className="sd-ann-arrow"><i className="bi bi-chevron-right"></i></span>
                  </div>
                ))}
              </div>
            </section>
          </div>
        )}

        {/* NEWS TAB */}
        {activeTab === 'news' && (
          <div className="sd-tab-content">
            <section className="sd-card">
              <h3 className="sd-section-title">Latest News</h3>
              <div className="sd-news-grid">
                {newsItems.map((news, idx) => (
                  <div key={idx} className="sd-news-card">
                    <div className="sd-news-thumbnail">
                      <i className="bi bi-newspaper"></i>
                    </div>
                    <div className="sd-news-info">
                      <span className="sd-news-title">{news.title}</span>
                      <div className="sd-news-meta">
                        <span className="sd-news-source">{news.source}</span>
                        <span className="sd-news-date">{news.date}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          </div>
        )}

        {/* ARTICLES TAB */}
        {activeTab === 'articles' && (
          <div className="sd-tab-content">
            <section className="sd-card">
              <h3 className="sd-section-title">Related Articles</h3>
              <div className="sd-articles-list">
                {relatedArticles.map((article, idx) => (
                  <div key={idx} className="sd-article-item">
                    <span className="sd-article-bullet"><i className="bi bi-journal-text"></i></span>
                    <div className="sd-article-info">
                      <span className="sd-article-title">{article.title}</span>
                      <span className="sd-article-date">{article.date}</span>
                    </div>
                    <span className="sd-article-arrow"><i className="bi bi-arrow-right"></i></span>
                  </div>
                ))}
              </div>
            </section>
          </div>
        )}

        {/* FAQ Section — always visible at bottom */}
        <section className="sd-card sd-faq-section">
          <h3 className="sd-section-title">Frequently Asked Questions</h3>
          <div className="sd-faq-list">
            {faqItems.map((faq, idx) => (
              <div key={idx} className={`sd-faq-item ${expandedFaq === idx ? 'expanded' : ''}`}>
                <button className="sd-faq-question" onClick={() => setExpandedFaq(expandedFaq === idx ? null : idx)}>
                  <span>{faq.q}</span>
                  <i className={`bi ${expandedFaq === idx ? 'bi-chevron-up' : 'bi-chevron-down'}`}></i>
                </button>
                {expandedFaq === idx && (
                  <div className="sd-faq-answer">
                    <p>{faq.a}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>
      </main>

      {/* Sticky bottom chatbot input bar */}
      <div className="sd-chat-bar">
        {showChatMention && chatMentionResults.length > 0 && (
          <div className="sd-chat-mention-list">
            {chatMentionResults.map((stock, idx) => (
              <button
                key={idx}
                className="sd-chat-mention-item"
                onMouseDown={e => {
                  e.preventDefault();
                  const lastAt = chatInput.lastIndexOf('@');
                  const newInput = chatInput.substring(0, lastAt) + '@' + stock.symbol + ' ';
                  setChatInput(newInput);
                  setChatMentionResults([]);
                  setShowChatMention(false);
                  chatbarMentionActiveRef.current = false;
                }}
              >
                <span className="sd-mention-symbol">{stock.symbol.replace(/_/g, ' ')}</span>
                {stock.price && <span className="sd-mention-price">{'\u20B9'}{stock.price}</span>}
              </button>
            ))}
          </div>
        )}
        <div className="sd-chat-bar-inner">
          <span className="sd-chat-bar-icon">&#10022;</span>
          <input
            type="text"
            className="sd-chat-bar-input"
            placeholder={`Ask about ${displayName} or type @ to mention another stock...`}
            value={chatInput}
            onChange={e => {
              const val = e.target.value;
              setChatInput(val);
              const lastAt = val.lastIndexOf('@');
              if (lastAt !== -1) {
                const afterAt = val.substring(lastAt + 1);
                if (!afterAt.includes(' ') && !afterAt.includes('\n')) {
                  chatbarMentionActiveRef.current = true;
                  if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
                    wsRef.current.send(JSON.stringify({ action: 'search', query: afterAt }));
                  }
                } else {
                  chatbarMentionActiveRef.current = false;
                  setShowChatMention(false);
                }
              } else {
                chatbarMentionActiveRef.current = false;
                setShowChatMention(false);
              }
            }}
            onKeyDown={e => {
              if (e.key === 'Escape') { setShowChatMention(false); return; }
              if (e.key === 'Enter' && chatInput.trim()) {
                setShowChatMention(false);
                chatbarMentionActiveRef.current = false;
                const msg = chatInput.trim();
                const finalMsg = msg.startsWith('@') ? msg : `@${stockName} ${msg}`;
                navigate('/', { state: { initialMessage: finalMsg } });
              }
            }}
            onBlur={() => setTimeout(() => setShowChatMention(false), 150)}
          />
          <button
            className="sd-chat-bar-send"
            disabled={!chatInput.trim()}
            onClick={() => {
              if (chatInput.trim()) {
                setShowChatMention(false);
                chatbarMentionActiveRef.current = false;
                const msg = chatInput.trim();
                const finalMsg = msg.startsWith('@') ? msg : `@${stockName} ${msg}`;
                navigate('/', { state: { initialMessage: finalMsg } });
              }
            }}
          >&#10148;</button>
        </div>
      </div>
    </div>
  );
};

export default StockDetailPage;

import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import '../styles/StockDetail.css';

const API_BASE = 'http://localhost:8000';

const StockDetailPage = () => {
  const { stockName } = useParams();
  const navigate = useNavigate();

  const [stockInfo, setStockInfo] = useState(null);
  const [tables, setTables] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [isDarkTheme, setIsDarkTheme] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');
  const [activeFinancialTab, setActiveFinancialTab] = useState('quarters');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searchOpen, setSearchOpen] = useState(false);

  const wsRef = React.useRef(null);

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
          setSearchResults(results);
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

  // Investment checklist items
  const getChecklist = () => {
    if (!stockInfo) return [];
    const items = [];
    const pe = parseFloat(stockInfo.stock_pe);
    const roce = parseFloat(stockInfo.roce);
    const roe = parseFloat(stockInfo.roe);
    const divYield = parseFloat(stockInfo.dividend_yield);

    items.push({
      label: 'Valuation',
      value: !isNaN(pe) ? (pe < 20 ? 'ATTRACTIVE' : pe < 40 ? 'REASONABLE' : 'EXPENSIVE') : 'N/A',
      status: !isNaN(pe) ? (pe < 20 ? 'good' : pe < 40 ? 'neutral' : 'bad') : 'neutral',
    });
    items.push({
      label: 'Profitability',
      value: !isNaN(roce) ? (roce > 20 ? 'HIGH MARGIN' : roce > 10 ? 'MODERATE' : 'LOW MARGIN') : 'N/A',
      status: !isNaN(roce) ? (roce > 20 ? 'good' : roce > 10 ? 'neutral' : 'bad') : 'neutral',
    });
    items.push({
      label: 'Returns',
      value: !isNaN(roe) ? (roe > 15 ? 'STRONG' : roe > 10 ? 'MODERATE' : 'WEAK') : 'N/A',
      status: !isNaN(roe) ? (roe > 15 ? 'good' : roe > 10 ? 'neutral' : 'bad') : 'neutral',
    });
    items.push({
      label: 'Dividend',
      value: !isNaN(divYield) ? (divYield > 2 ? 'HIGH YIELD' : divYield > 0.5 ? 'MODERATE' : 'LOW YIELD') : 'N/A',
      status: !isNaN(divYield) ? (divYield > 2 ? 'good' : divYield > 0.5 ? 'neutral' : 'bad') : 'neutral',
    });
    return items;
  };

  const tabs = [
    { id: 'overview', label: 'Overview', icon: '\uD83D\uDCCB' },
    { id: 'financials', label: 'Financials', icon: '\uD83D\uDCCA' },
    { id: 'shareholding', label: 'Shareholdings', icon: '\uD83C\uDFE6' },
    { id: 'pros-cons', label: 'Pros & Cons', icon: '\u2696\uFE0F' },
  ];

  const financialTabs = [
    { id: 'quarters', label: 'Quarterly' },
    { id: 'profit-loss', label: 'Profit & Loss' },
    { id: 'balance-sheet', label: 'Balance Sheet' },
    { id: 'cash-flow', label: 'Cash Flow' },
    { id: 'ratios', label: 'Ratios' },
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
            <span className="sd-search-icon">{'\uD83D\uDD0D'}</span>
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
          <button className="sd-theme-btn" onClick={() => setIsDarkTheme(!isDarkTheme)}>
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
              <span className="sd-search-icon-lg">{'\uD83D\uDD0D'}</span>
              <input
                type="text"
                autoFocus
                value={searchQuery}
                onChange={(e) => handleSearch(e.target.value)}
                placeholder="Search stocks, ETF, IPO..."
                className="sd-search-input"
              />
              <button className="sd-search-close" onClick={() => { setSearchOpen(false); setSearchResults([]); setSearchQuery(''); }}>{'\u2715'}</button>
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
                    <span className="sd-result-action">{'\u2197'}</span>
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
        <span>{'\u203A'}</span>
        <button onClick={() => navigate('/')}>All Stocks</button>
        <span>{'\u203A'}</span>
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
              <span className="sd-stock-symbol">{stockName.toUpperCase()}</span>
            </div>
            <button className="sd-watchlist-btn">+ Watchlist</button>
          </div>

          <div className="sd-price-row">
            <span className="sd-price">{stockInfo.current_price || 'N/A'}</span>
            <div className="sd-price-meta">
              <div className="sd-meta-item">
                <span className="sd-meta-label">Market Cap</span>
                <span className="sd-meta-value">{stockInfo.market_cap || 'N/A'}</span>
              </div>
              <div className="sd-meta-item">
                <span className="sd-meta-label">P/E</span>
                <span className="sd-meta-value">{stockInfo.stock_pe || 'N/A'}</span>
              </div>
              <div className="sd-meta-item">
                <span className="sd-meta-label">Book Value</span>
                <span className="sd-meta-value">{stockInfo.book_value || 'N/A'}</span>
              </div>
              <div className="sd-meta-item">
                <span className="sd-meta-label">52W High/Low</span>
                <span className="sd-meta-value">{stockInfo.high_low || 'N/A'}</span>
              </div>
            </div>
          </div>
        </section>

        {/* Investment Checklist Card */}
        <section className="sd-card">
          <h3 className="sd-section-title">Investment Checklist</h3>
          <div className="sd-checklist-grid">
            {getChecklist().map((item, idx) => (
              <div key={idx} className={`sd-checklist-card ${item.status}`}>
                <span className="sd-checklist-label">{item.label}</span>
                <span className="sd-checklist-value">{item.value}</span>
                <span className={`sd-checklist-icon ${item.status}`}>
                  {item.status === 'good' ? '\u2713' : item.status === 'bad' ? '\u2717' : '\u2014'}
                </span>
              </div>
            ))}
          </div>
        </section>

        {/* Key Metrics Card */}
        <section className="sd-card">
          <h3 className="sd-section-title">Key Metrics</h3>
          <div className="sd-metrics-grid">
            {[
              { label: 'ROCE', value: stockInfo.roce },
              { label: 'ROE', value: stockInfo.roe },
              { label: 'Dividend Yield', value: stockInfo.dividend_yield },
              { label: 'Face Value', value: stockInfo.face_value },
              { label: 'P/E Ratio', value: stockInfo.stock_pe },
              { label: 'Book Value', value: stockInfo.book_value },
            ].map((m, idx) => (
              <div key={idx} className="sd-metric-card">
                <span className="sd-metric-label">{m.label}</span>
                <span className="sd-metric-value">{m.value || 'N/A'}</span>
              </div>
            ))}
          </div>
        </section>

        {/* Tabs */}
        <div className="sd-tabs">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              className={`sd-tab ${activeTab === tab.id ? 'active' : ''}`}
              onClick={() => setActiveTab(tab.id)}
            >
              <span className="sd-tab-icon">{tab.icon}</span>
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        <div className="sd-card sd-tab-content">
          {/* Overview */}
          {activeTab === 'overview' && (
            <div className="sd-overview">
              <h3 className="sd-section-title">Overview</h3>
              <p className="sd-about-text">{stockInfo.about || 'No description available.'}</p>
            </div>
          )}

          {/* Financials */}
          {activeTab === 'financials' && (
            <div className="sd-financials">
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
            </div>
          )}

          {/* Shareholding */}
          {activeTab === 'shareholding' && (
            <div className="sd-shareholding">
              <h3 className="sd-section-title">Shareholding Pattern</h3>
              {(() => {
                const { headers, rows } = getTableData('shareholding');
                if (rows.length === 0) {
                  return <div className="sd-no-data">No shareholding data available</div>;
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
            </div>
          )}

          {/* Pros & Cons */}
          {activeTab === 'pros-cons' && (
            <div className="sd-pros-cons">
              <div className="sd-pros-cons-grid">
                <div className="sd-pros-section">
                  <h3 className="sd-section-title sd-pros-title">Strengths</h3>
                  {Array.isArray(stockInfo.pros) && stockInfo.pros.length > 0 ? (
                    <ul className="sd-pros-list">
                      {stockInfo.pros.map((p, i) => (
                        <li key={i}><span className="sd-pro-icon">{'\u2713'}</span>{p}</li>
                      ))}
                    </ul>
                  ) : (
                    <p className="sd-no-data">No strengths data available</p>
                  )}
                </div>
                <div className="sd-cons-section">
                  <h3 className="sd-section-title sd-cons-title">Weaknesses</h3>
                  {Array.isArray(stockInfo.cons) && stockInfo.cons.length > 0 ? (
                    <ul className="sd-cons-list">
                      {stockInfo.cons.map((c, i) => (
                        <li key={i}><span className="sd-con-icon">{'\u2717'}</span>{c}</li>
                      ))}
                    </ul>
                  ) : (
                    <p className="sd-no-data">No weaknesses data available</p>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Floating Chatbot Button - navigates to chatbot page */}
      <button
        className="sd-chat-fab"
        onClick={() => navigate('/')}
        title="Ask EvenStocks AI"
      >
        {'\u2728'}
      </button>
    </div>
  );
};

export default StockDetailPage;

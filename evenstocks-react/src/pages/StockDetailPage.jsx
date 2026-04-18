import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTheme } from '../context/ThemeContext';
import '../styles/StockDetail.css';

const API_BASE = 'http://localhost:8000';
const WS_URL = 'ws://localhost:8000';

/* ─── tiny reusable: tooltip icon ─── */
const Tip = ({ text }) => {
  const [show, setShow] = useState(false);
  return (
    <span className="sd-tip-wrap" onMouseEnter={() => setShow(true)} onMouseLeave={() => setShow(false)}>
      <i className="bi bi-info-circle sd-tip-icon"></i>
      {show && <span className="sd-tip-bubble">{text}</span>}
    </span>
  );
};

/* ─── SVG arc gauge ─── */
const ScoreGauge = ({ score, max = 10, label, color }) => {
  const pct = Math.min(score / max, 1);
  const r = 54, cx = 60, cy = 60, stroke = 8;
  const circ = 2 * Math.PI * r;
  const dash = circ * pct;
  return (
    <div className="sd-score-gauge">
      <svg viewBox="0 0 120 120" width="120" height="120">
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="currentColor" strokeWidth={stroke} className="sd-gauge-bg" />
        <circle cx={cx} cy={cy} r={r} fill="none" stroke={color} strokeWidth={stroke}
          strokeDasharray={`${dash} ${circ}`} strokeLinecap="round"
          transform={`rotate(-90 ${cx} ${cy})`} className="sd-gauge-arc" />
        <text x={cx} y={cy - 6} textAnchor="middle" className="sd-gauge-score">{score}</text>
        <text x={cx} y={cy + 14} textAnchor="middle" className="sd-gauge-max">/ {max}</text>
      </svg>
      <span className="sd-gauge-lbl">{label}</span>
    </div>
  );
};

const StockDetailPage = () => {
  const { stockName } = useParams();
  const navigate = useNavigate();
  const { isDark: isDarkTheme, toggleTheme } = useTheme();

  // ─── existing state ───
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

  // ─── NEW interactive state ───
  const [selectedReturnPeriod, setSelectedReturnPeriod] = useState('5Y');
  const [selectedPivotType, setSelectedPivotType] = useState('classic');
  const [expandedSections, setExpandedSections] = useState({});
  const [watchlisted, setWatchlisted] = useState(false);

  const wsRef = useRef(null);
  const chatbarMentionActiveRef = useRef(false);

  const displayName = stockName.replace(/_/g, ' ');

  // ─── fetch stock data ───
  useEffect(() => {
    setLoading(true);
    setError('');
    fetch(`${API_BASE}/api/stocks/${stockName}`)
      .then((res) => { if (!res.ok) throw new Error('Stock not found'); return res.json(); })
      .then((data) => { setStockInfo(data.info); setTables(data.tables); setLoading(false); })
      .catch((err) => { setError(err.message); setLoading(false); });
  }, [stockName]);

  // ─── WebSocket for search ───
  useEffect(() => {
    const connectWs = () => {
      const ws = new WebSocket(`${WS_URL}/ws/stock-chat`);
      ws.onopen = () => { wsRef.current = ws; };
      ws.onmessage = (event) => {
        const data = JSON.parse(event.data);
        if (data.type === 'search_results') {
          const results = data.results.map((r) => ({ symbol: r.stock_name, name: r.stock_name.replace(/_/g, ' '), price: r.current_price || '' }));
          if (chatbarMentionActiveRef.current) { setChatMentionResults(results); setShowChatMention(results.length > 0); }
          else { setSearchResults(results); }
        }
      };
      ws.onclose = () => { wsRef.current = null; setTimeout(connectWs, 3000); };
      ws.onerror = () => { ws.close(); };
    };
    connectWs();
    return () => { if (wsRef.current) wsRef.current.close(); };
  }, []);

  // ─── Ctrl+K ───
  useEffect(() => {
    const handler = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') { e.preventDefault(); setSearchOpen(true); }
      if (e.key === 'Escape') { setSearchOpen(false); setSearchResults([]); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  // ─── close search on outside click ───
  useEffect(() => {
    const handler = (e) => {
      if (searchOpen && !e.target.closest('.sd-search-modal') && !e.target.closest('.sd-search-trigger')) { setSearchOpen(false); setSearchResults([]); }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [searchOpen]);

  const handleSearch = (query) => {
    setSearchQuery(query);
    if (wsRef.current?.readyState === WebSocket.OPEN) wsRef.current.send(JSON.stringify({ action: 'search', query: query.trim() }));
    if (!query.trim()) setSearchResults([]);
  };

  const handleSearchSelect = (stock) => { setSearchOpen(false); setSearchQuery(''); setSearchResults([]); navigate(`/stock/${stock.symbol}`); };

  // ─── parse financial table ───
  const getTableData = useCallback((tableType) => {
    const data = tables[tableType];
    if (!data) return { headers: [], rows: [] };
    let rows = [];
    if (Array.isArray(data) && data.length > 0) {
      if (Array.isArray(data[0])) rows = data[0] || [];
      else if (typeof data[0] === 'object') rows = data;
    }
    if (rows.length === 0) return { headers: [], rows: [] };
    const headers = Object.keys(rows[0]);
    return { headers, rows: rows.slice(0, 20) };
  }, [tables]);

  const toggleSection = (key) => setExpandedSections(prev => ({ ...prev, [key]: !prev[key] }));

  /* ═══════════════════════════════════════════════════
     COMPUTED FINANCIAL DATA
     ═══════════════════════════════════════════════════ */

  const safeFloat = (v) => { const n = parseFloat(v); return isNaN(n) ? null : n; };

  const price = useMemo(() => safeFloat(stockInfo?.current_price), [stockInfo]);
  const pe = useMemo(() => safeFloat(stockInfo?.stock_pe), [stockInfo]);
  const bookVal = useMemo(() => safeFloat(stockInfo?.book_value), [stockInfo]);
  const roce = useMemo(() => safeFloat(stockInfo?.roce), [stockInfo]);
  const roe = useMemo(() => safeFloat(stockInfo?.roe), [stockInfo]);
  const divYield = useMemo(() => safeFloat(stockInfo?.dividend_yield), [stockInfo]);
  const faceVal = useMemo(() => safeFloat(stockInfo?.face_value), [stockInfo]);
  const pb = useMemo(() => (price && bookVal) ? (price / bookVal).toFixed(2) : null, [price, bookVal]);
  const eps = useMemo(() => (price && pe) ? (price / pe).toFixed(2) : null, [price, pe]);

  // 52-week range position
  const rangePosition = useMemo(() => {
    if (!stockInfo?.high_low || !price) return 50;
    const parts = stockInfo.high_low.split('/');
    if (parts.length < 2) return 50;
    const high = parseFloat(parts[0]?.trim());
    const low = parseFloat(parts[1]?.trim());
    if (isNaN(high) || isNaN(low) || high === low) return 50;
    return Math.max(0, Math.min(100, ((price - low) / (high - low)) * 100));
  }, [stockInfo, price]);

  /* ─── EvenStocks composite score ─── */
  const esScore = useMemo(() => {
    if (!stockInfo) return { total: 0, fundamental: 0, valuation: 0, quality: 0, growth: 0 };
    let fundamental = 5, valuation = 5, quality = 5, growth = 5;
    // Valuation
    if (pe !== null) { if (pe < 15) valuation = 9; else if (pe < 25) valuation = 7; else if (pe < 40) valuation = 5; else valuation = 3; }
    // Quality
    if (roce !== null) { if (roce > 25) quality = 9; else if (roce > 15) quality = 7; else if (roce > 8) quality = 5; else quality = 3; }
    if (roe !== null) { quality = Math.round((quality + (roe > 20 ? 9 : roe > 12 ? 7 : roe > 5 ? 5 : 3)) / 2); }
    // Fundamental
    if (divYield !== null) { if (divYield > 3) fundamental = 9; else if (divYield > 1.5) fundamental = 7; else if (divYield > 0.5) fundamental = 5; else fundamental = 4; }
    if (pb !== null) { const pbf = parseFloat(pb); fundamental = Math.round((fundamental + (pbf < 2 ? 8 : pbf < 4 ? 6 : pbf < 8 ? 4 : 3)) / 2); }
    // Growth (placeholder)
    growth = 7;
    const total = Math.round((fundamental + valuation + quality + growth) / 4 * 10) / 10;
    return { total, fundamental, valuation, quality, growth };
  }, [stockInfo, pe, roce, roe, divYield, pb]);

  const scoreColor = (s) => s >= 7 ? '#4ade80' : s >= 5 ? '#fbbf24' : '#f87171';

  /* ─── Returns calculator ─── */
  const returnsData = useMemo(() => {
    const invested = 100000;
    const rates = { '1Y': 0.18, '3Y': 0.55, '5Y': 1.1, '10Y': 3.2 };
    const r = rates[selectedReturnPeriod] || 0;
    const currentVal = Math.round(invested * (1 + r));
    const profit = currentVal - invested;
    const cagr = selectedReturnPeriod === '1Y' ? (r * 100).toFixed(1) : (Math.pow(1 + r, 1 / parseInt(selectedReturnPeriod)) - 1) * 100;
    return { invested, currentVal, profit, cagr: typeof cagr === 'number' ? cagr.toFixed(1) : cagr, period: selectedReturnPeriod };
  }, [selectedReturnPeriod]);

  /* ─── Investment checklist (expanded) ─── */
  const getChecklist = () => {
    if (!stockInfo) return [];
    const items = [];
    items.push({ category: 'Performance', label: 'Stock Performance', value: 'Positive', detail: 'Stock return vs Nifty return', status: 'good' });
    items.push({ category: 'Valuation', label: 'Valuation', value: pe !== null ? (pe < 20 ? 'Undervalued' : pe < 40 ? 'Fairly Valued' : 'Overvalued') : 'N/A', detail: `P/E: ${pe !== null ? pe.toFixed(1) : 'N/A'} | P/B: ${pb || 'N/A'}`, status: pe !== null ? (pe < 20 ? 'good' : pe < 40 ? 'neutral' : 'bad') : 'neutral' });
    items.push({ category: 'Growth', label: 'Revenue Growth', value: 'Growing', detail: 'YoY Revenue CAGR trend', status: 'good' });
    items.push({ category: 'Profitability', label: 'Profitability', value: roce !== null ? (roce > 20 ? 'High Margin' : roce > 10 ? 'Moderate' : 'Low Margin') : 'N/A', detail: `ROCE: ${roce !== null ? roce + '%' : 'N/A'} | ROE: ${roe !== null ? roe + '%' : 'N/A'}`, status: roce !== null ? (roce > 20 ? 'good' : roce > 10 ? 'neutral' : 'bad') : 'neutral' });
    items.push({ category: 'Technicals', label: 'Technical Signal', value: 'Neutral', detail: 'Based on RSI, MACD, MAs', status: 'neutral' });
    items.push({ category: 'Risk', label: 'Risk Assessment', value: divYield !== null ? (divYield > 2 ? 'Low Risk' : divYield > 0.5 ? 'Medium Risk' : 'High Risk') : 'N/A', detail: `Div Yield: ${divYield !== null ? divYield + '%' : 'N/A'}`, status: divYield !== null ? (divYield > 2 ? 'good' : divYield > 0.5 ? 'neutral' : 'bad') : 'neutral' });
    items.push({ category: 'Solvency', label: 'Debt Health', value: 'Manageable', detail: 'D/E Ratio within norms', status: 'good' });
    items.push({ category: 'Cash Flow', label: 'Cash Generation', value: 'Strong', detail: 'Positive OCF, healthy FCF', status: 'good' });
    return items;
  };

  // ─── Tabs ───
  const tabs = [
    { id: 'overview', label: 'Overview', icon: 'bi-grid' },
    { id: 'technicals', label: 'Technicals', icon: 'bi-activity' },
    { id: 'forecast', label: 'Forecast', icon: 'bi-graph-up-arrow' },
    { id: 'peers', label: 'Peers', icon: 'bi-people' },
    { id: 'financials', label: 'Financials', icon: 'bi-calculator' },
    { id: 'shareholding', label: 'Shareholdings', icon: 'bi-pie-chart' },
    { id: 'projection', label: 'Projection', icon: 'bi-bullseye' },
    { id: 'documents', label: 'Documents', icon: 'bi-folder' },
    { id: 'actions', label: 'Actions', icon: 'bi-lightning' },
    { id: 'announcements', label: 'Announcements', icon: 'bi-megaphone' },
    { id: 'news', label: 'News', icon: 'bi-newspaper' },
    { id: 'articles', label: 'Articles', icon: 'bi-journal-text' },
  ];

  const financialTabs = [
    { id: 'quarters', label: 'Quarterly Results' },
    { id: 'profit-loss', label: 'Profit & Loss' },
    { id: 'balance-sheet', label: 'Balance Sheet' },
    { id: 'cash-flow', label: 'Cash Flow' },
    { id: 'ratios', label: 'Ratios' },
  ];

  /* ═══════════════════════════════════════════════════
     PLACEHOLDER DATA (to be replaced by real API data)
     ═══════════════════════════════════════════════════ */

  // Compounded growth rates
  const cagrData = [
    { metric: 'Revenue', y1: '12.4%', y3: '14.8%', y5: '11.2%', y10: '13.6%' },
    { metric: 'Net Profit', y1: '18.2%', y3: '16.5%', y5: '14.1%', y10: '15.8%' },
    { metric: 'Stock Price', y1: '22.5%', y3: '18.3%', y5: '16.8%', y10: '14.2%' },
    { metric: 'EPS', y1: '15.1%', y3: '14.2%', y5: '12.8%', y10: '13.4%' },
    { metric: 'Dividend', y1: '10.0%', y3: '12.5%', y5: '11.0%', y10: '9.8%' },
  ];

  // Return ratios trend
  const returnRatiosTrend = [
    { year: 'FY26E', roe: '17.2%', roce: '7.8%', roa: '2.1%', nim: '3.6%' },
    { year: 'FY25', roe: '16.8%', roce: '7.5%', roa: '2.0%', nim: '3.5%' },
    { year: 'FY24', roe: '16.2%', roce: '7.2%', roa: '1.9%', nim: '3.4%' },
    { year: 'FY23', roe: '15.5%', roce: '6.9%', roa: '1.8%', nim: '3.3%' },
    { year: 'FY22', roe: '13.1%', roce: '6.4%', roa: '1.6%', nim: '3.1%' },
  ];

  // Debt & solvency
  const debtMetrics = [
    { label: 'Debt to Equity', value: '0.85', status: 'neutral', tip: 'Total debt divided by shareholder equity. Below 1 is generally healthy for banks.' },
    { label: 'Interest Coverage', value: '1.8x', status: 'good', tip: 'EBIT divided by interest expense. Higher is better — shows ability to pay debt.' },
    { label: 'Current Ratio', value: '1.12', status: 'neutral', tip: 'Current assets / current liabilities. Above 1 means short-term obligations are covered.' },
    { label: 'Capital Adequacy (CAR)', value: '19.8%', status: 'good', tip: 'Regulatory capital ratio. Above 12% is strong for Indian banks.' },
    { label: 'Gross NPA', value: '1.24%', status: 'good', tip: 'Non-performing assets as % of total advances. Lower is better.' },
    { label: 'Net NPA', value: '0.33%', status: 'good', tip: 'NPAs after provisions. Under 1% is excellent.' },
  ];

  // Cash flow highlights
  const cashFlowHighlights = [
    { label: 'Operating Cash Flow', value: '₹58,420 Cr', change: '+14.2%', positive: true },
    { label: 'Free Cash Flow', value: '₹42,180 Cr', change: '+11.8%', positive: true },
    { label: 'CFO / Net Profit', value: '1.32x', change: '', positive: true },
    { label: 'Capex', value: '₹16,240 Cr', change: '+8.5%', positive: false },
  ];

  // Quarterly trend (last 4 quarters)
  const quarterlyTrend = [
    { quarter: 'Q3 FY26', revenue: '68,250', revGrowth: '+18.2%', profit: '17,820', profitGrowth: '+15.4%', opm: '32.5%' },
    { quarter: 'Q2 FY26', revenue: '65,100', revGrowth: '+16.8%', profit: '16,450', profitGrowth: '+12.1%', opm: '31.8%' },
    { quarter: 'Q1 FY26', revenue: '62,800', revGrowth: '+15.5%', profit: '15,980', profitGrowth: '+10.8%', opm: '31.2%' },
    { quarter: 'Q4 FY25', revenue: '60,200', revGrowth: '+14.1%', profit: '15,100', profitGrowth: '+9.5%', opm: '30.5%' },
  ];

  // Peer data
  const peerData = [
    { symbol: 'ICICI Bank', price: '1,285.50', marketCap: '8,95,000 Cr', pe: '18.2', pb: '3.1', divYield: '0.8%', roe: '17.5%', roce: '7.2%', roa: '2.1%' },
    { symbol: 'SBI', price: '825.30', marketCap: '7,36,000 Cr', pe: '10.5', pb: '1.8', divYield: '1.7%', roe: '20.1%', roce: '6.8%', roa: '1.0%' },
    { symbol: 'Kotak Bank', price: '1,870.40', marketCap: '3,72,000 Cr', pe: '22.8', pb: '3.5', divYield: '0.1%', roe: '14.2%', roce: '7.5%', roa: '2.3%' },
    { symbol: 'Axis Bank', price: '1,145.20', marketCap: '3,54,000 Cr', pe: '14.3', pb: '2.4', divYield: '0.1%', roe: '18.3%', roce: '7.0%', roa: '1.7%' },
    { symbol: 'IndusInd Bank', price: '1,420.60', marketCap: '1,10,000 Cr', pe: '12.1', pb: '1.9', divYield: '0.9%', roe: '16.0%', roce: '8.1%', roa: '1.8%' },
  ];

  // Shareholding pattern
  const shareholdingPattern = [
    { holder: 'Promoters', percentage: 0 },
    { holder: 'FII/FPI', percentage: 55.2 },
    { holder: 'DII', percentage: 21.8 },
    { holder: 'Public', percentage: 23.0 },
  ];

  const shareholdingHistory = [
    { quarter: 'Dec 2025', promoters: '0.00%', fii: '55.20%', dii: '21.80%', public: '23.00%' },
    { quarter: 'Sep 2025', promoters: '0.00%', fii: '54.80%', dii: '22.10%', public: '23.10%' },
    { quarter: 'Jun 2025', promoters: '0.00%', fii: '54.50%', dii: '22.30%', public: '23.20%' },
    { quarter: 'Mar 2025', promoters: '0.00%', fii: '54.10%', dii: '22.60%', public: '23.30%' },
  ];

  // Mutual fund holdings
  const mfHoldings = [
    { fund: 'SBI Bluechip Fund', aum: '₹42,500 Cr', holding: '3.8%', change: '+0.2%', positive: true },
    { fund: 'HDFC Flexi Cap Fund', aum: '₹38,200 Cr', holding: '5.1%', change: '+0.1%', positive: true },
    { fund: 'ICICI Pru Balanced Advantage', aum: '₹55,800 Cr', holding: '2.9%', change: '-0.1%', positive: false },
    { fund: 'Axis Long Term Equity', aum: '₹28,400 Cr', holding: '4.2%', change: '+0.3%', positive: true },
    { fund: 'Kotak Emerging Equity', aum: '₹32,100 Cr', holding: '1.8%', change: '0.0%', positive: true },
  ];

  // Promoter pledge
  const promoterPledge = { pledged: 0, total: 0, pctPledged: '0.00%', trend: 'Stable' };

  // Documents
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

  // Actions
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
    splits: [
      { date: 'Sep 2019', from: '₹2', to: '₹1', ratio: '2:1' },
    ],
    bulkDeals: [
      { date: '12 Jan 2026', client: 'Goldman Sachs Singapore', type: 'Buy', qty: '12,50,000', price: '1,748.50', value: '₹218.6 Cr' },
      { date: '05 Jan 2026', client: 'Morgan Stanley Asia', type: 'Buy', qty: '8,40,000', price: '1,722.30', value: '₹144.7 Cr' },
      { date: '28 Dec 2025', client: 'Citigroup Global', type: 'Sell', qty: '6,20,000', price: '1,710.80', value: '₹106.1 Cr' },
    ],
  };

  // Announcements
  const announcements = [
    { title: 'Board Meeting Outcome - Quarterly Results', date: '18 Jan 2026', category: 'Board Meeting' },
    { title: 'Disclosure under Regulation 30 - Analyst Meet', date: '10 Jan 2026', category: 'Disclosure' },
    { title: 'Change in Directors / Key Personnel', date: '02 Jan 2026', category: 'Personnel' },
    { title: 'Credit Rating Update - CRISIL AAA/Stable', date: '20 Dec 2025', category: 'Rating' },
    { title: 'Allotment of Equity Shares under ESOP', date: '15 Dec 2025', category: 'ESOP' },
    { title: 'Disclosure of Related Party Transactions', date: '05 Dec 2025', category: 'Disclosure' },
  ];

  // News
  const newsItems = [
    { title: `${displayName} reports strong Q3 results, net profit up 15%`, source: 'Economic Times', date: '18 Jan 2026', thumbnail: '' },
    { title: `${displayName} board approves interim dividend of Rs 19.50 per share`, source: 'Moneycontrol', date: '18 Jan 2026', thumbnail: '' },
    { title: `Foreign investors increase stake in ${displayName}`, source: 'LiveMint', date: '15 Jan 2026', thumbnail: '' },
    { title: `${displayName} launches new digital banking platform`, source: 'Business Standard', date: '10 Jan 2026', thumbnail: '' },
    { title: `Analysts bullish on ${displayName} ahead of Q3 results`, source: 'NDTV Profit', date: '05 Jan 2026', thumbnail: '' },
  ];

  // Articles
  const relatedArticles = [
    { title: `Is ${displayName} a good investment in 2026?`, date: '15 Jan 2026' },
    { title: `${displayName} vs ICICI Bank: Which is the better buy?`, date: '10 Jan 2026' },
    { title: `Complete guide to ${displayName} fundamentals`, date: '05 Jan 2026' },
    { title: `${displayName} dividend history and analysis`, date: '28 Dec 2025' },
    { title: `Technical analysis: ${displayName} price targets for 2026`, date: '20 Dec 2025' },
  ];

  // Pivot Points
  const pivotPoints = {
    classic: { r3: '1,812', r2: '1,790', r1: '1,768', pp: '1,752', s1: '1,730', s2: '1,714', s3: '1,692' },
    fibonacci: { r3: '1,805', r2: '1,785', r1: '1,772', pp: '1,752', s1: '1,732', s2: '1,719', s3: '1,699' },
    camarilla: { r3: '1,776', r2: '1,768', r1: '1,760', pp: '1,752', s1: '1,744', s2: '1,736', s3: '1,728' },
  };

  // Volatility metrics
  const volatilityMetrics = [
    { label: 'Beta', value: '0.92', tip: 'Measures volatility relative to the market. Below 1 = less volatile than Nifty.' },
    { label: 'Std. Deviation (1Y)', value: '22.4%', tip: 'Annualized price volatility. Lower means more predictable.' },
    { label: 'Sharpe Ratio', value: '1.28', tip: 'Risk-adjusted return. Above 1 means good return per unit of risk.' },
    { label: 'Sortino Ratio', value: '1.65', tip: 'Like Sharpe but only penalizes downside volatility. Higher is better.' },
    { label: 'Max Drawdown (1Y)', value: '-12.8%', tip: 'Largest peak-to-trough decline in last 12 months.' },
    { label: 'Value at Risk (95%)', value: '-2.1%', tip: 'Maximum expected daily loss at 95% confidence level.' },
  ];

  // FAQ
  const faqItems = [
    { q: `What is the current share price of ${displayName}?`, a: `The current share price of ${displayName} is ${stockInfo?.current_price || 'N/A'}. Stock prices are subject to market fluctuations and change throughout trading hours.` },
    { q: `Is ${displayName} a good buy right now?`, a: `Investment decisions should be based on thorough research. Check the EvenStocks Score (${esScore.total}/10), Investment Checklist, and Technicals sections for detailed insights. Always consider your personal risk tolerance and investment horizon.` },
    { q: `What is the P/E ratio of ${displayName}?`, a: `The P/E ratio is ${stockInfo?.stock_pe || 'N/A'}. A lower P/E relative to peers may indicate undervaluation. Compare with the industry average in the Peers section.` },
    { q: `Does ${displayName} pay dividends?`, a: `${displayName} has a dividend yield of ${stockInfo?.dividend_yield || 'N/A'}%. Check the Actions tab for complete dividend history and upcoming ex-dates.` },
    { q: `What is the ROCE and ROE of ${displayName}?`, a: `ROCE: ${stockInfo?.roce || 'N/A'}%, ROE: ${stockInfo?.roe || 'N/A'}%. These ratios indicate how efficiently the company uses capital to generate profits. Higher values indicate better capital efficiency.` },
    { q: `What do analysts recommend for ${displayName}?`, a: `Check the Forecast tab for detailed analyst recommendations including consensus target prices, buy/sell/hold ratings, and price forecast for different time horizons.` },
    { q: `How has ${displayName}'s revenue grown over the years?`, a: `Revenue has shown a CAGR of ~13.6% over the last 10 years. Check the Compounded Growth section in Overview for detailed growth metrics across revenue, profit, EPS, and stock price.` },
    { q: `What is the debt level of ${displayName}?`, a: `The company maintains a healthy debt profile. Key metrics like D/E ratio, interest coverage, and NPA levels can be found in the Debt & Solvency section of the Overview tab.` },
  ];

  /* ═══════════════════════════════════════════════════
     RENDER
     ═══════════════════════════════════════════════════ */

  if (loading) {
    return (
      <div className={`sd-page ${isDarkTheme ? 'dark' : 'light'}`}>
        <div className="sd-loading"><div className="sd-spinner"></div><p>Loading {displayName}...</p></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`sd-page ${isDarkTheme ? 'dark' : 'light'}`}>
        <div className="sd-error"><h2>Stock Not Found</h2><p>{error}</p><button onClick={() => navigate('/')}>Go to Chatbot</button></div>
      </div>
    );
  }

  return (
    <div className={`sd-page ${isDarkTheme ? 'dark' : 'light'}`}>
      {/* ═════ TOP BAR ═════ */}
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
          <button className="sd-theme-btn" onClick={toggleTheme}>{isDarkTheme ? '\u2600\uFE0F' : '\uD83C\uDF19'}</button>
          <button className="sd-user-btn">U</button>
        </div>
      </header>

      {/* ═════ SEARCH OVERLAY ═════ */}
      {searchOpen && (
        <div className="sd-search-overlay" onClick={() => { setSearchOpen(false); setSearchResults([]); }}>
          <div className="sd-search-modal" onClick={(e) => e.stopPropagation()}>
            <div className="sd-search-header">
              <span className="sd-search-icon-lg">&#128269;</span>
              <input type="text" autoFocus value={searchQuery} onChange={(e) => handleSearch(e.target.value)} placeholder="Search stocks, ETF, IPO..." className="sd-search-input" />
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
              {searchResults.length > 0 ? searchResults.map((stock, idx) => (
                <button key={idx} className="sd-search-result-row" onClick={() => handleSearchSelect(stock)}>
                  <div className="sd-result-icon"><span>{stock.symbol[0]}</span></div>
                  <div className="sd-result-info">
                    <span className="sd-result-symbol">{stock.symbol.replace(/_/g, ' ').toUpperCase()}</span>
                    <span className="sd-result-name">{stock.name}</span>
                  </div>
                  <span className="sd-result-tag">STOCK</span>
                  <span className="sd-result-action">&#8599;</span>
                </button>
              )) : searchQuery ? (
                <div className="sd-no-results">No results found for "{searchQuery}"</div>
              ) : (
                <div className="sd-no-results">Type to search stocks...</div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ═════ BREADCRUMB ═════ */}
      <div className="sd-breadcrumb">
        <button onClick={() => navigate('/')}>Home</button><span>&#8250;</span>
        <button onClick={() => navigate('/')}>All Stocks</button><span>&#8250;</span>
        <span className="sd-breadcrumb-current">{displayName}</span>
      </div>

      {/* ═════ MAIN CONTENT ═════ */}
      <main className="sd-main">

        {/* ─── STOCK HEADER CARD ─── */}
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
              <button className={`sd-watchlist-btn ${watchlisted ? 'active' : ''}`} onClick={() => setWatchlisted(!watchlisted)}>
                <i className={`bi ${watchlisted ? 'bi-bookmark-fill' : 'bi-bookmark'}`}></i> {watchlisted ? 'Watchlisted' : 'Watchlist'}
              </button>
              <button className="sd-share-btn"><i className="bi bi-share"></i></button>
            </div>
          </div>

          <div className="sd-price-row">
            <div className="sd-price-block">
              <span className="sd-price">{price ? `\u20B9${price.toLocaleString('en-IN')}` : 'N/A'}</span>
              <span className="sd-price-change positive">+12.50 (0.72%)</span>
            </div>
            <div className="sd-price-meta">
              {[
                { label: 'Market Cap', value: stockInfo.market_cap || 'N/A' },
                { label: 'P/E Ratio', value: pe !== null ? pe.toFixed(1) : 'N/A' },
                { label: 'P/B Ratio', value: pb || 'N/A' },
                { label: 'EPS (TTM)', value: eps ? `\u20B9${eps}` : 'N/A' },
                { label: 'Div Yield', value: divYield !== null ? divYield + '%' : 'N/A' },
                { label: 'ROCE', value: roce !== null ? roce + '%' : 'N/A' },
                { label: 'ROE', value: roe !== null ? roe + '%' : 'N/A' },
              ].map((m, i) => (
                <div key={i} className="sd-meta-item">
                  <span className="sd-meta-label">{m.label}</span>
                  <span className="sd-meta-value">{m.value}</span>
                </div>
              ))}
            </div>
          </div>

          {/* 52 Week Range */}
          <div className="sd-range-bar">
            <div className="sd-range-labels">
              <span>52W Low: {stockInfo.high_low ? stockInfo.high_low.split('/')[1]?.trim() || 'N/A' : 'N/A'}</span>
              <span>52W High: {stockInfo.high_low ? stockInfo.high_low.split('/')[0]?.trim() || 'N/A' : 'N/A'}</span>
            </div>
            <div className="sd-range-track">
              <div className="sd-range-fill" style={{ width: `${rangePosition}%` }}></div>
              <div className="sd-range-marker" style={{ left: `${rangePosition}%` }}></div>
            </div>
          </div>
        </section>

        {/* ─── EVENSTOCKS SCORE ─── */}
        <section className="sd-card sd-score-card">
          <div className="sd-section-header">
            <h3 className="sd-section-title">EvenStocks Score <Tip text="Composite score based on valuation, quality, fundamentals, and growth. Higher is better." /></h3>
            <div className="sd-score-verdict" style={{ color: scoreColor(esScore.total) }}>
              {esScore.total >= 7 ? 'Strong' : esScore.total >= 5 ? 'Average' : 'Weak'}
            </div>
          </div>
          <div className="sd-score-grid">
            <div className="sd-score-main">
              <ScoreGauge score={esScore.total} label="Overall" color={scoreColor(esScore.total)} />
            </div>
            <div className="sd-score-breakdown">
              <ScoreGauge score={esScore.valuation} label="Valuation" color={scoreColor(esScore.valuation)} />
              <ScoreGauge score={esScore.quality} label="Quality" color={scoreColor(esScore.quality)} />
              <ScoreGauge score={esScore.fundamental} label="Fundamental" color={scoreColor(esScore.fundamental)} />
              <ScoreGauge score={esScore.growth} label="Growth" color={scoreColor(esScore.growth)} />
            </div>
          </div>
        </section>

        {/* ─── INVESTMENT CHECKLIST ─── */}
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

        {/* ─── KEY METRICS DASHBOARD ─── */}
        <section className="sd-card">
          <h3 className="sd-section-title">Key Metrics Dashboard <Tip text="Core financial ratios that institutional investors monitor. Click any metric for detail." /></h3>
          <div className="sd-metrics-grid">
            {[
              { label: 'ROCE', value: roce !== null ? roce + '%' : 'N/A', tip: 'Return on Capital Employed — how well capital is used.' },
              { label: 'ROE', value: roe !== null ? roe + '%' : 'N/A', tip: 'Return on Equity — profit per rupee of shareholder equity.' },
              { label: 'P/E Ratio', value: pe !== null ? pe.toFixed(1) : 'N/A', tip: 'Price to Earnings — lower is cheaper relative to earnings.' },
              { label: 'P/B Ratio', value: pb || 'N/A', tip: 'Price to Book — below 1 may indicate undervaluation.' },
              { label: 'EPS (TTM)', value: eps ? `\u20B9${eps}` : 'N/A', tip: 'Earnings Per Share — profit attributable per share.' },
              { label: 'Div Yield', value: divYield !== null ? divYield + '%' : 'N/A', tip: 'Annual dividend as % of price. Higher = more income.' },
              { label: 'Book Value', value: bookVal ? `\u20B9${bookVal}` : 'N/A', tip: 'Net asset value per share from balance sheet.' },
              { label: 'Face Value', value: faceVal ? `\u20B9${faceVal}` : 'N/A', tip: 'Nominal value of one share as per company.' },
              { label: '52W High/Low', value: stockInfo.high_low || 'N/A', tip: '52-week price range — shows how price moved.' },
              { label: 'Market Cap', value: stockInfo.market_cap || 'N/A', tip: 'Total market valuation = Price x Total Shares.' },
              { label: 'Industry P/E', value: '18.5', tip: 'Average P/E of the banking sector for comparison.' },
              { label: 'PEG Ratio', value: pe !== null ? (pe / 15).toFixed(2) : 'N/A', tip: 'P/E divided by growth rate. Below 1 = undervalued vs growth.' },
              { label: 'EV/EBITDA', value: '14.2', tip: 'Enterprise Value / EBITDA — valuation net of cash and debt.' },
              { label: 'Price/Sales', value: '3.8', tip: 'Market cap divided by revenue. Useful for high-growth firms.' },
              { label: 'Operating Margin', value: '32.5%', tip: 'Operating profit as % of revenue. Higher = more efficient.' },
              { label: 'Net Margin', value: '26.1%', tip: 'Net profit as % of revenue after all expenses and taxes.' },
            ].map((m, idx) => (
              <div key={idx} className="sd-metric-card">
                <span className="sd-metric-label">{m.label} <Tip text={m.tip} /></span>
                <span className="sd-metric-value">{m.value}</span>
              </div>
            ))}
          </div>
        </section>

        {/* ─── PRICE CHART ─── */}
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

        {/* ═════ TABS NAVIGATION ═════ */}
        <div className="sd-tabs">
          {tabs.map((tab) => (
            <button key={tab.id} className={`sd-tab ${activeTab === tab.id ? 'active' : ''}`} onClick={() => setActiveTab(tab.id)}>
              <i className={`bi ${tab.icon} sd-tab-icon`}></i> {tab.label}
            </button>
          ))}
        </div>

        {/* ═══════════════════ OVERVIEW TAB ═══════════════════ */}
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
                  <ul className="sd-pros-list">{stockInfo.pros.map((p, i) => (<li key={i}><span className="sd-pro-icon">&#10003;</span>{p}</li>))}</ul>
                ) : (<p className="sd-no-data">No strengths data available</p>)}
              </div>
              <div className="sd-card sd-cons-section">
                <h3 className="sd-section-title sd-cons-title">Weaknesses</h3>
                {Array.isArray(stockInfo.cons) && stockInfo.cons.length > 0 ? (
                  <ul className="sd-cons-list">{stockInfo.cons.map((c, i) => (<li key={i}><span className="sd-con-icon">&#10007;</span>{c}</li>))}</ul>
                ) : (<p className="sd-no-data">No weaknesses data available</p>)}
              </div>
            </div>

            {/* ─── STOCK RETURNS CALCULATOR ─── */}
            <section className="sd-card sd-returns-card">
              <div className="sd-section-header">
                <h3 className="sd-section-title">Returns Calculator <Tip text="Hypothetical returns if you had invested ₹1,00,000 at different points in time." /></h3>
                <div className="sd-return-periods">
                  {['1Y', '3Y', '5Y', '10Y'].map(p => (
                    <button key={p} className={`sd-period-btn ${selectedReturnPeriod === p ? 'active' : ''}`} onClick={() => setSelectedReturnPeriod(p)}>{p}</button>
                  ))}
                </div>
              </div>
              <div className="sd-returns-grid">
                <div className="sd-return-item">
                  <span className="sd-return-label">Invested</span>
                  <span className="sd-return-value">{'\u20B9'}1,00,000</span>
                </div>
                <div className="sd-return-item">
                  <span className="sd-return-label">Current Value</span>
                  <span className="sd-return-value sd-return-highlight">{'\u20B9'}{returnsData.currentVal.toLocaleString('en-IN')}</span>
                </div>
                <div className="sd-return-item">
                  <span className="sd-return-label">Total Returns</span>
                  <span className="sd-return-value positive">{returnsData.profit >= 0 ? '+' : ''}{'\u20B9'}{returnsData.profit.toLocaleString('en-IN')}</span>
                </div>
                <div className="sd-return-item">
                  <span className="sd-return-label">CAGR</span>
                  <span className="sd-return-value positive">{returnsData.cagr}%</span>
                </div>
              </div>
            </section>

            {/* ─── COMPOUNDED GROWTH RATES ─── */}
            <section className="sd-card">
              <h3 className="sd-section-title">Compounded Growth Rates <Tip text="CAGR — compound annual growth rate over different periods. Shows consistency." /></h3>
              <div className="sd-table-wrapper">
                <table className="sd-table">
                  <thead><tr><th>Metric</th><th>1 Year</th><th>3 Years</th><th>5 Years</th><th>10 Years</th></tr></thead>
                  <tbody>
                    {cagrData.map((row, i) => (
                      <tr key={i}>
                        <td><strong>{row.metric}</strong></td>
                        <td className="sd-cagr-cell">{row.y1}</td>
                        <td className="sd-cagr-cell">{row.y3}</td>
                        <td className="sd-cagr-cell">{row.y5}</td>
                        <td className="sd-cagr-cell">{row.y10}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            {/* ─── QUARTERLY TREND ─── */}
            <section className="sd-card">
              <h3 className="sd-section-title">Quarterly Performance Trend</h3>
              <div className="sd-quarterly-grid">
                {quarterlyTrend.map((q, i) => (
                  <div key={i} className="sd-quarterly-card">
                    <span className="sd-q-label">{q.quarter}</span>
                    <div className="sd-q-row">
                      <span className="sd-q-metric">Revenue</span>
                      <span className="sd-q-val">{'\u20B9'}{q.revenue} Cr</span>
                      <span className={`sd-q-change ${q.revGrowth.startsWith('+') ? 'positive' : 'negative'}`}>{q.revGrowth}</span>
                    </div>
                    <div className="sd-q-row">
                      <span className="sd-q-metric">Net Profit</span>
                      <span className="sd-q-val">{'\u20B9'}{q.profit} Cr</span>
                      <span className={`sd-q-change ${q.profitGrowth.startsWith('+') ? 'positive' : 'negative'}`}>{q.profitGrowth}</span>
                    </div>
                    <div className="sd-q-row">
                      <span className="sd-q-metric">OPM</span>
                      <span className="sd-q-val">{q.opm}</span>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            {/* ─── RETURN RATIOS TREND ─── */}
            <section className="sd-card">
              <h3 className="sd-section-title">Return Ratios Trend <Tip text="Key profitability ratios over multiple fiscal years. Rising trend indicates improving efficiency." /></h3>
              <div className="sd-table-wrapper">
                <table className="sd-table">
                  <thead><tr><th>Year</th><th>ROE</th><th>ROCE</th><th>ROA</th><th>NIM</th></tr></thead>
                  <tbody>
                    {returnRatiosTrend.map((row, i) => (
                      <tr key={i}><td><strong>{row.year}</strong></td><td>{row.roe}</td><td>{row.roce}</td><td>{row.roa}</td><td>{row.nim}</td></tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            {/* ─── DEBT & SOLVENCY ─── */}
            <section className="sd-card">
              <div className="sd-section-header">
                <h3 className="sd-section-title">Debt & Solvency Analysis</h3>
                <span className="sd-section-subtitle">Key solvency and asset quality metrics</span>
              </div>
              <div className="sd-debt-grid">
                {debtMetrics.map((d, i) => (
                  <div key={i} className={`sd-debt-item ${d.status}`}>
                    <div className="sd-debt-top">
                      <span className={`sd-checklist-dot ${d.status}`}></span>
                      <span className="sd-debt-label">{d.label} <Tip text={d.tip} /></span>
                    </div>
                    <span className="sd-debt-value">{d.value}</span>
                  </div>
                ))}
              </div>
            </section>

            {/* ─── CASH FLOW HIGHLIGHTS ─── */}
            <section className="sd-card">
              <h3 className="sd-section-title">Cash Flow Highlights <Tip text="Operating cash flow quality determines a company's real earning power. CFO/PAT above 1x is healthy." /></h3>
              <div className="sd-cashflow-grid">
                {cashFlowHighlights.map((cf, i) => (
                  <div key={i} className="sd-cashflow-card">
                    <span className="sd-cf-label">{cf.label}</span>
                    <span className="sd-cf-value">{cf.value}</span>
                    {cf.change && <span className={`sd-cf-change ${cf.positive ? 'positive' : 'negative'}`}>{cf.change}</span>}
                  </div>
                ))}
              </div>
            </section>

            {/* Stock Info Grid */}
            <section className="sd-card">
              <h3 className="sd-section-title">Stock Information</h3>
              <div className="sd-info-grid">
                {[
                  { label: 'Market Cap', value: stockInfo.market_cap || 'N/A' },
                  { label: 'Current Price', value: price ? `\u20B9${price.toLocaleString('en-IN')}` : 'N/A' },
                  { label: 'High / Low', value: stockInfo.high_low || 'N/A' },
                  { label: 'Stock P/E', value: pe !== null ? pe.toFixed(1) : 'N/A' },
                  { label: 'Book Value', value: bookVal ? `\u20B9${bookVal}` : 'N/A' },
                  { label: 'Dividend Yield', value: divYield !== null ? divYield + '%' : 'N/A' },
                  { label: 'ROCE', value: roce !== null ? roce + '%' : 'N/A' },
                  { label: 'ROE', value: roe !== null ? roe + '%' : 'N/A' },
                  { label: 'Face Value', value: faceVal ? `\u20B9${faceVal}` : 'N/A' },
                  { label: 'EPS (TTM)', value: eps ? `\u20B9${eps}` : 'N/A' },
                  { label: 'P/B Ratio', value: pb || 'N/A' },
                  { label: 'Industry P/E', value: '18.5' },
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

        {/* ═══════════════════ TECHNICALS TAB ═══════════════════ */}
        {activeTab === 'technicals' && (
          <div className="sd-tab-content">
            <section className="sd-card">
              <h3 className="sd-section-title">Technical Analysis</h3>
              <div className="sd-technicals-grid">
                {[
                  { title: 'Oscillators', label: 'Neutral', sell: 2, neutral: 6, buy: 3 },
                  { title: 'Overall', label: 'Neutral', sell: 5, neutral: 9, buy: 12 },
                  { title: 'Moving Averages', label: 'Buy', sell: 3, neutral: 1, buy: 11 },
                ].map((g, i) => (
                  <div key={i} className="sd-technical-card">
                    <h4 className="sd-technical-title">{g.title}</h4>
                    <div className="sd-gauge-placeholder">
                      <div className="sd-gauge-circle"><span className="sd-gauge-label">{g.label}</span></div>
                    </div>
                    <div className="sd-signal-counts">
                      <span className="sd-signal sell">Sell: {g.sell}</span>
                      <span className="sd-signal neutral">Neutral: {g.neutral}</span>
                      <span className="sd-signal buy">Buy: {g.buy}</span>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            {/* Pivot Points */}
            <section className="sd-card">
              <div className="sd-section-header">
                <h3 className="sd-section-title">Pivot Points <Tip text="Support & resistance levels calculated from previous day's high, low, close. Used by day traders." /></h3>
                <div className="sd-pivot-types">
                  {['classic', 'fibonacci', 'camarilla'].map(t => (
                    <button key={t} className={`sd-period-btn ${selectedPivotType === t ? 'active' : ''}`} onClick={() => setSelectedPivotType(t)}>
                      {t.charAt(0).toUpperCase() + t.slice(1)}
                    </button>
                  ))}
                </div>
              </div>
              <div className="sd-pivot-grid">
                {['r3', 'r2', 'r1', 'pp', 's1', 's2', 's3'].map(level => (
                  <div key={level} className={`sd-pivot-item ${level === 'pp' ? 'pivot-point' : level.startsWith('r') ? 'resistance' : 'support'}`}>
                    <span className="sd-pivot-label">{level.toUpperCase()}</span>
                    <span className="sd-pivot-value">{'\u20B9'}{pivotPoints[selectedPivotType][level]}</span>
                  </div>
                ))}
              </div>
            </section>

            {/* Volatility & Risk Metrics */}
            <section className="sd-card">
              <h3 className="sd-section-title">Volatility & Risk Metrics <Tip text="Risk-adjusted performance measures used by portfolio managers and quant funds." /></h3>
              <div className="sd-volatility-grid">
                {volatilityMetrics.map((v, i) => (
                  <div key={i} className="sd-vol-card">
                    <span className="sd-vol-label">{v.label} <Tip text={v.tip} /></span>
                    <span className="sd-vol-value">{v.value}</span>
                  </div>
                ))}
              </div>
            </section>

            {/* Technical Indicators Table */}
            <section className="sd-card">
              <h3 className="sd-section-title">Technical Indicators</h3>
              <div className="sd-table-wrapper">
                <table className="sd-table">
                  <thead><tr><th>Indicator</th><th>Value</th><th>Signal</th></tr></thead>
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
                      { name: 'Ultimate Oscillator', value: '58.20', signal: 'Buy' },
                      { name: 'ROC (12)', value: '4.8%', signal: 'Buy' },
                    ].map((ind, idx) => (
                      <tr key={idx}>
                        <td>{ind.name}</td><td>{ind.value}</td>
                        <td><span className={`sd-signal-badge ${ind.signal.toLowerCase()}`}>{ind.signal}</span></td>
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
                  <thead><tr><th>Period</th><th>Simple</th><th>Exponential</th><th>Signal</th></tr></thead>
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
                        <td>{ma.period}</td><td>{ma.simple}</td><td>{ma.exp}</td>
                        <td><span className={`sd-signal-badge ${ma.signal.toLowerCase()}`}>{ma.signal}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          </div>
        )}

        {/* ═══════════════════ FORECAST TAB ═══════════════════ */}
        {activeTab === 'forecast' && (
          <div className="sd-tab-content">
            <section className="sd-card">
              <h3 className="sd-section-title">Price Forecast</h3>
              <div className="sd-forecast-grid">
                {[
                  { period: '1 Month', pct: '+2.5%' },
                  { period: '3 Months', pct: '+5.8%' },
                  { period: '6 Months', pct: '+12.3%' },
                  { period: '1 Year', pct: '+18.7%' },
                ].map((f, i) => (
                  <div key={i} className="sd-forecast-card">
                    <span className="sd-forecast-period">{f.period}</span>
                    <span className="sd-forecast-target positive">{f.pct}</span>
                    <span className="sd-forecast-price">Target: {price ? `\u20B9${(price * (1 + parseFloat(f.pct) / 100)).toFixed(2)}` : 'N/A'}</span>
                  </div>
                ))}
              </div>
            </section>

            {/* Consensus Estimates */}
            <section className="sd-card">
              <h3 className="sd-section-title">Consensus Estimates <Tip text="Aggregated analyst estimates for upcoming quarters. Consensus = median of all estimates." /></h3>
              <div className="sd-table-wrapper">
                <table className="sd-table">
                  <thead><tr><th>Quarter</th><th>Revenue Est.</th><th>EPS Est.</th><th>Previous EPS</th><th>Surprise</th></tr></thead>
                  <tbody>
                    {[
                      { q: 'Q4 FY26E', rev: '₹72,500 Cr', eps: '₹28.50', prev: '₹25.10', surprise: '+13.5%' },
                      { q: 'Q1 FY27E', rev: '₹75,200 Cr', eps: '₹30.20', prev: '-', surprise: '-' },
                      { q: 'Q2 FY27E', rev: '₹78,100 Cr', eps: '₹31.80', prev: '-', surprise: '-' },
                    ].map((e, i) => (
                      <tr key={i}><td><strong>{e.q}</strong></td><td>{e.rev}</td><td>{e.eps}</td><td>{e.prev}</td>
                        <td>{e.surprise !== '-' ? <span className="sd-price-change positive">{e.surprise}</span> : '-'}</td></tr>
                    ))}
                  </tbody>
                </table>
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
                  <span>Strong Buy: 14</span><span>Buy: 12</span><span>Hold: 8</span><span>Sell: 4</span><span>Strong Sell: 2</span>
                </div>
              </div>
            </section>

            <section className="sd-card">
              <h3 className="sd-section-title">Price Forecast Chart</h3>
              <div className="sd-chart-placeholder">
                <div className="sd-chart-placeholder-inner"><i className="bi bi-graph-up-arrow"></i><p>Forecast chart with confidence intervals will be displayed here</p></div>
              </div>
            </section>
          </div>
        )}

        {/* ═══════════════════ PEERS TAB ═══════════════════ */}
        {activeTab === 'peers' && (
          <div className="sd-tab-content">
            <section className="sd-card">
              <h3 className="sd-section-title">Peer Comparison</h3>
              <div className="sd-table-wrapper">
                <table className="sd-table">
                  <thead><tr><th>Company</th><th>Price</th><th>Market Cap</th><th>P/E</th><th>P/B</th><th>Div Yield</th><th>ROE</th><th>ROCE</th><th>ROA</th></tr></thead>
                  <tbody>
                    <tr className="sd-peer-current">
                      <td><strong>{displayName}</strong></td>
                      <td>{price ? price.toLocaleString('en-IN') : 'N/A'}</td>
                      <td>{stockInfo.market_cap || 'N/A'}</td>
                      <td>{pe !== null ? pe.toFixed(1) : 'N/A'}</td>
                      <td>{pb || 'N/A'}</td>
                      <td>{divYield !== null ? divYield + '%' : 'N/A'}</td>
                      <td>{roe !== null ? roe + '%' : 'N/A'}</td>
                      <td>{roce !== null ? roce + '%' : 'N/A'}</td>
                      <td>N/A</td>
                    </tr>
                    {peerData.map((peer, idx) => (
                      <tr key={idx}><td>{peer.symbol}</td><td>{peer.price}</td><td>{peer.marketCap}</td><td>{peer.pe}</td><td>{peer.pb}</td><td>{peer.divYield}</td><td>{peer.roe}</td><td>{peer.roce}</td><td>{peer.roa}</td></tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
            <section className="sd-card">
              <h3 className="sd-section-title">Price Chart Comparison</h3>
              <div className="sd-chart-placeholder"><div className="sd-chart-placeholder-inner"><i className="bi bi-bar-chart-line"></i><p>Peer price comparison chart will be displayed here</p></div></div>
            </section>
          </div>
        )}

        {/* ═══════════════════ FINANCIALS TAB ═══════════════════ */}
        {activeTab === 'financials' && (
          <div className="sd-tab-content">
            <section className="sd-card">
              <div className="sd-financial-header">
                <div className="sd-financial-tabs">
                  {financialTabs.map((ft) => (
                    <button key={ft.id} className={`sd-fin-tab ${activeFinancialTab === ft.id ? 'active' : ''}`} onClick={() => setActiveFinancialTab(ft.id)}>{ft.label}</button>
                  ))}
                </div>
                <div className="sd-financial-toggles">
                  <button className={`sd-toggle-btn ${!showFinancialPercent ? 'active' : ''}`} onClick={() => setShowFinancialPercent(false)}>Total Figures</button>
                  <button className={`sd-toggle-btn ${showFinancialPercent ? 'active' : ''}`} onClick={() => setShowFinancialPercent(true)}>% Changes</button>
                  <button className="sd-toggle-btn">View Standalone</button>
                </div>
              </div>
              {(() => {
                const { headers, rows } = getTableData(activeFinancialTab);
                if (rows.length === 0) return <div className="sd-no-data">No {activeFinancialTab} data available</div>;
                return (
                  <div className="sd-table-wrapper">
                    <table className="sd-table">
                      <thead><tr>{headers.map((h, i) => <th key={i}>{h}</th>)}</tr></thead>
                      <tbody>{rows.map((row, i) => <tr key={i}>{headers.map((h, j) => <td key={j}>{row[h] ?? ''}</td>)}</tr>)}</tbody>
                    </table>
                  </div>
                );
              })()}
            </section>
          </div>
        )}

        {/* ═══════════════════ SHAREHOLDINGS TAB ═══════════════════ */}
        {activeTab === 'shareholding' && (
          <div className="sd-tab-content">
            <section className="sd-card">
              <h3 className="sd-section-title">Shareholding Pattern</h3>
              <div className="sd-shareholding-visual">
                <div className="sd-pie-placeholder">
                  <div className="sd-pie-circle"><p>Pie Chart</p><p className="sd-pie-sub">Chart placeholder</p></div>
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

            {/* Promoter Pledge */}
            <section className="sd-card">
              <h3 className="sd-section-title">Promoter Pledge Status <Tip text="Pledged shares by promoters can be a risk indicator. High pledging may lead to forced selling." /></h3>
              <div className="sd-pledge-grid">
                <div className="sd-pledge-item"><span className="sd-pledge-label">Pledged Shares</span><span className="sd-pledge-value">{promoterPledge.pctPledged}</span></div>
                <div className="sd-pledge-item"><span className="sd-pledge-label">Pledge Trend</span><span className="sd-pledge-value sd-pledge-good">{promoterPledge.trend}</span></div>
              </div>
            </section>

            {/* Shareholding History */}
            <section className="sd-card">
              <h3 className="sd-section-title">Shareholding History (Quarterly)</h3>
              <div className="sd-table-wrapper">
                <table className="sd-table">
                  <thead><tr><th>Quarter</th><th>Promoters</th><th>FII/FPI</th><th>DII</th><th>Public</th></tr></thead>
                  <tbody>
                    {shareholdingHistory.map((row, idx) => (
                      <tr key={idx}><td>{row.quarter}</td><td>{row.promoters}</td><td>{row.fii}</td><td>{row.dii}</td><td>{row.public}</td></tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            {/* Mutual Fund Holdings */}
            <section className="sd-card">
              <h3 className="sd-section-title">Top Mutual Fund Holdings <Tip text="Largest mutual fund schemes holding this stock. Rising MF interest is a positive signal." /></h3>
              <div className="sd-table-wrapper">
                <table className="sd-table">
                  <thead><tr><th>Fund Name</th><th>AUM</th><th>Holding %</th><th>QoQ Change</th></tr></thead>
                  <tbody>
                    {mfHoldings.map((mf, i) => (
                      <tr key={i}>
                        <td><strong>{mf.fund}</strong></td><td>{mf.aum}</td><td>{mf.holding}</td>
                        <td><span className={`sd-price-change ${mf.positive ? 'positive' : 'negative'}`}>{mf.change}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            {/* API shareholding data */}
            {(() => {
              const { headers, rows } = getTableData('shareholding');
              if (rows.length === 0) return null;
              return (
                <section className="sd-card">
                  <h3 className="sd-section-title">Detailed Shareholding Data</h3>
                  <div className="sd-table-wrapper">
                    <table className="sd-table">
                      <thead><tr>{headers.map((h, i) => <th key={i}>{h}</th>)}</tr></thead>
                      <tbody>{rows.map((row, i) => <tr key={i}>{headers.map((h, j) => <td key={j}>{row[h] ?? ''}</td>)}</tr>)}</tbody>
                    </table>
                  </div>
                </section>
              );
            })()}

            <section className="sd-card">
              <h3 className="sd-section-title">Shareholding Trend</h3>
              <div className="sd-chart-placeholder"><div className="sd-chart-placeholder-inner"><i className="bi bi-pie-chart"></i><p>Shareholding trend chart will be displayed here</p></div></div>
            </section>
          </div>
        )}

        {/* ═══════════════════ PROJECTION TAB ═══════════════════ */}
        {activeTab === 'projection' && (
          <div className="sd-tab-content">
            <section className="sd-card">
              <h3 className="sd-section-title">Revenue & Profit Projection</h3>
              <div className="sd-chart-placeholder sd-chart-tall"><div className="sd-chart-placeholder-inner"><i className="bi bi-graph-up-arrow"></i><p>Revenue and profit projection chart will be displayed here</p></div></div>
            </section>
            <section className="sd-card">
              <h3 className="sd-section-title">EPS Projection</h3>
              <div className="sd-chart-placeholder"><div className="sd-chart-placeholder-inner"><i className="bi bi-graph-up"></i><p>EPS projection chart will be displayed here</p></div></div>
            </section>
            <section className="sd-card">
              <h3 className="sd-section-title">Target Price Estimates</h3>
              <div className="sd-table-wrapper">
                <table className="sd-table">
                  <thead><tr><th>Analyst Firm</th><th>Target Price</th><th>Recommendation</th><th>Date</th></tr></thead>
                  <tbody>
                    {[
                      { firm: 'Morgan Stanley', target: '2,050', rec: 'Overweight', date: 'Jan 2026' },
                      { firm: 'Goldman Sachs', target: '1,980', rec: 'Buy', date: 'Jan 2026' },
                      { firm: 'JP Morgan', target: '1,900', rec: 'Overweight', date: 'Dec 2025' },
                      { firm: 'CLSA', target: '1,850', rec: 'Buy', date: 'Dec 2025' },
                      { firm: 'Motilal Oswal', target: '2,100', rec: 'Buy', date: 'Jan 2026' },
                    ].map((row, idx) => (
                      <tr key={idx}><td>{row.firm}</td><td>{'\u20B9'}{row.target}</td><td><span className="sd-signal-badge buy">{row.rec}</span></td><td>{row.date}</td></tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          </div>
        )}

        {/* ═══════════════════ DOCUMENTS TAB ═══════════════════ */}
        {activeTab === 'documents' && (
          <div className="sd-tab-content">
            {[
              { title: 'Investor Presentations', data: documents.presentations, icon: 'bi-file-earmark-pdf' },
              { title: 'Concall Transcripts', data: documents.concalls, icon: 'bi-file-earmark-text' },
              { title: 'Annual Reports', data: documents.reports, icon: 'bi-file-earmark-bar-graph' },
            ].map((section, si) => (
              <section key={si} className="sd-card">
                <h3 className="sd-section-title">{section.title}</h3>
                <div className="sd-documents-grid">
                  {section.data.map((doc, idx) => (
                    <div key={idx} className="sd-document-card">
                      <div className="sd-doc-icon"><i className={`bi ${section.icon}`}></i></div>
                      <div className="sd-doc-info"><span className="sd-doc-title">{doc.title}</span><span className="sd-doc-date">{doc.date}</span></div>
                      <span className="sd-doc-type">{doc.type}</span>
                    </div>
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}

        {/* ═══════════════════ ACTIONS TAB ═══════════════════ */}
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

            {/* Stock Splits */}
            <section className="sd-card">
              <h3 className="sd-section-title">Stock Split History</h3>
              <div className="sd-table-wrapper">
                <table className="sd-table">
                  <thead><tr><th>Date</th><th>From (FV)</th><th>To (FV)</th><th>Ratio</th></tr></thead>
                  <tbody>
                    {actions.splits.map((s, i) => (
                      <tr key={i}><td>{s.date}</td><td>{s.from}</td><td>{s.to}</td><td>{s.ratio}</td></tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            {/* Dividend History */}
            <section className="sd-card">
              <h3 className="sd-section-title">Dividend History</h3>
              <div className="sd-table-wrapper">
                <table className="sd-table">
                  <thead><tr><th>Date</th><th>Type</th><th>Amount ({'\u20B9'})</th><th>Ex-Date</th></tr></thead>
                  <tbody>
                    {actions.dividends.map((div, idx) => (
                      <tr key={idx}><td>{div.date}</td><td><span className="sd-dividend-type">{div.type}</span></td><td>{'\u20B9'}{div.amount}</td><td>{div.exDate}</td></tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            {/* Bulk / Block Deals */}
            <section className="sd-card">
              <h3 className="sd-section-title">Recent Bulk & Block Deals <Tip text="Large transactions (>0.5% of total shares) by institutional investors. Shows big-money positioning." /></h3>
              <div className="sd-table-wrapper">
                <table className="sd-table">
                  <thead><tr><th>Date</th><th>Client</th><th>Type</th><th>Qty</th><th>Price</th><th>Value</th></tr></thead>
                  <tbody>
                    {actions.bulkDeals.map((deal, i) => (
                      <tr key={i}>
                        <td>{deal.date}</td><td><strong>{deal.client}</strong></td>
                        <td><span className={`sd-signal-badge ${deal.type.toLowerCase()}`}>{deal.type}</span></td>
                        <td>{deal.qty}</td><td>{'\u20B9'}{deal.price}</td><td>{deal.value}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            {/* Dividend Trend Chart */}
            <section className="sd-card">
              <h3 className="sd-section-title">Dividend Trend</h3>
              <div className="sd-chart-placeholder"><div className="sd-chart-placeholder-inner"><i className="bi bi-bar-chart"></i><p>Dividend trend chart will be displayed here</p></div></div>
            </section>
          </div>
        )}

        {/* ═══════════════════ ANNOUNCEMENTS TAB ═══════════════════ */}
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
                    <div className="sd-announcement-info"><span className="sd-ann-title">{ann.title}</span><span className="sd-ann-category">{ann.category}</span></div>
                    <span className="sd-ann-arrow"><i className="bi bi-chevron-right"></i></span>
                  </div>
                ))}
              </div>
            </section>
          </div>
        )}

        {/* ═══════════════════ NEWS TAB ═══════════════════ */}
        {activeTab === 'news' && (
          <div className="sd-tab-content">
            <section className="sd-card">
              <h3 className="sd-section-title">Latest News</h3>
              <div className="sd-news-grid">
                {newsItems.map((news, idx) => (
                  <div key={idx} className="sd-news-card">
                    <div className="sd-news-thumbnail"><i className="bi bi-newspaper"></i></div>
                    <div className="sd-news-info">
                      <span className="sd-news-title">{news.title}</span>
                      <div className="sd-news-meta"><span className="sd-news-source">{news.source}</span><span className="sd-news-date">{news.date}</span></div>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          </div>
        )}

        {/* ═══════════════════ ARTICLES TAB ═══════════════════ */}
        {activeTab === 'articles' && (
          <div className="sd-tab-content">
            <section className="sd-card">
              <h3 className="sd-section-title">Related Articles</h3>
              <div className="sd-articles-list">
                {relatedArticles.map((article, idx) => (
                  <div key={idx} className="sd-article-item">
                    <span className="sd-article-bullet"><i className="bi bi-journal-text"></i></span>
                    <div className="sd-article-info"><span className="sd-article-title">{article.title}</span><span className="sd-article-date">{article.date}</span></div>
                    <span className="sd-article-arrow"><i className="bi bi-arrow-right"></i></span>
                  </div>
                ))}
              </div>
            </section>
          </div>
        )}

        {/* ═══════════════════ FAQ ═══════════════════ */}
        <section className="sd-card sd-faq-section">
          <h3 className="sd-section-title">Frequently Asked Questions</h3>
          <div className="sd-faq-list">
            {faqItems.map((faq, idx) => (
              <div key={idx} className={`sd-faq-item ${expandedFaq === idx ? 'expanded' : ''}`}>
                <button className="sd-faq-question" onClick={() => setExpandedFaq(expandedFaq === idx ? null : idx)}>
                  <span>{faq.q}</span>
                  <i className={`bi ${expandedFaq === idx ? 'bi-chevron-up' : 'bi-chevron-down'}`}></i>
                </button>
                {expandedFaq === idx && <div className="sd-faq-answer"><p>{faq.a}</p></div>}
              </div>
            ))}
          </div>
        </section>
      </main>

      {/* ═════ STICKY CHATBOT INPUT BAR ═════ */}
      <div className="sd-chat-bar">
        {showChatMention && chatMentionResults.length > 0 && (
          <div className="sd-chat-mention-list">
            {chatMentionResults.map((stock, idx) => (
              <button key={idx} className="sd-chat-mention-item" onMouseDown={e => {
                e.preventDefault();
                const lastAt = chatInput.lastIndexOf('@');
                const newInput = chatInput.substring(0, lastAt) + '@' + stock.symbol + ' ';
                setChatInput(newInput); setChatMentionResults([]); setShowChatMention(false); chatbarMentionActiveRef.current = false;
              }}>
                <span className="sd-mention-symbol">{stock.symbol.replace(/_/g, ' ')}</span>
                {stock.price && <span className="sd-mention-price">{'\u20B9'}{stock.price}</span>}
              </button>
            ))}
          </div>
        )}
        <div className="sd-chat-bar-inner">
          <span className="sd-chat-bar-icon">&#10022;</span>
          <input type="text" className="sd-chat-bar-input" placeholder={`Ask about ${displayName} or type @ to mention another stock...`}
            value={chatInput}
            onChange={e => {
              const val = e.target.value;
              setChatInput(val);
              const lastAt = val.lastIndexOf('@');
              if (lastAt !== -1) {
                const afterAt = val.substring(lastAt + 1);
                if (!afterAt.includes(' ') && !afterAt.includes('\n')) {
                  chatbarMentionActiveRef.current = true;
                  if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) wsRef.current.send(JSON.stringify({ action: 'search', query: afterAt }));
                } else { chatbarMentionActiveRef.current = false; setShowChatMention(false); }
              } else { chatbarMentionActiveRef.current = false; setShowChatMention(false); }
            }}
            onKeyDown={e => {
              if (e.key === 'Escape') { setShowChatMention(false); return; }
              if (e.key === 'Enter' && chatInput.trim()) {
                setShowChatMention(false); chatbarMentionActiveRef.current = false;
                const msg = chatInput.trim();
                navigate('/', { state: { initialMessage: msg.startsWith('@') ? msg : `@${stockName} ${msg}` } });
              }
            }}
            onBlur={() => setTimeout(() => setShowChatMention(false), 150)}
          />
          <button className="sd-chat-bar-send" disabled={!chatInput.trim()} onClick={() => {
            if (chatInput.trim()) {
              setShowChatMention(false); chatbarMentionActiveRef.current = false;
              const msg = chatInput.trim();
              navigate('/', { state: { initialMessage: msg.startsWith('@') ? msg : `@${stockName} ${msg}` } });
            }
          }}>&#10148;</button>
        </div>
      </div>
    </div>
  );
};

export default StockDetailPage;

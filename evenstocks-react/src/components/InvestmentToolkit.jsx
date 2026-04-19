import React, { useEffect, useRef, useState } from 'react';
import '../styles/InvestmentToolkit.css';

const BACKEND_API = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';
const CHATBOT_API = 'http://localhost:8000';

const StockAutocomplete = ({ value, onChange, placeholder }) => {
  const [results, setResults] = useState([]);
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const wrapRef = useRef(null);
  const debounceRef = useRef(null);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    const q = (value || '').trim();
    if (!q) { setResults([]); return; }
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`${CHATBOT_API}/api/stocks/search?q=${encodeURIComponent(q)}`);
        if (!res.ok) { setResults([]); return; }
        const data = await res.json();
        setResults((data.results || []).slice(0, 8));
      } catch { setResults([]); }
    }, 180);
    return () => debounceRef.current && clearTimeout(debounceRef.current);
  }, [value]);

  useEffect(() => {
    const onDocClick = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, []);

  const pick = (name) => { onChange(name); setOpen(false); setResults([]); };

  const onKey = (e) => {
    if (!open || results.length === 0) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); setHighlight((h) => (h + 1) % results.length); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setHighlight((h) => (h - 1 + results.length) % results.length); }
    else if (e.key === 'Enter') { e.preventDefault(); pick(results[highlight].stock_name); }
    else if (e.key === 'Escape') { setOpen(false); }
  };

  return (
    <div className="ik-autocomplete" ref={wrapRef}>
      <input
        className="ik-input"
        placeholder={placeholder}
        value={value}
        onChange={(e) => { onChange(e.target.value); setOpen(true); setHighlight(0); }}
        onFocus={() => setOpen(true)}
        onKeyDown={onKey}
      />
      {open && results.length > 0 && (
        <ul className="ik-suggest">
          {results.map((r, i) => (
            <li
              key={r.stock_name}
              className={i === highlight ? 'active' : ''}
              onMouseDown={(e) => { e.preventDefault(); pick(r.stock_name); }}
              onMouseEnter={() => setHighlight(i)}
            >
              <span className="ik-suggest-name">{r.stock_name.replace(/_/g, ' ')}</span>
              {r.current_price && <span className="ik-suggest-price">₹{r.current_price}</span>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

const TABS = [
  { id: 'compare', label: 'Compare', icon: 'bi-arrow-left-right' },
  { id: 'portfolio', label: 'Portfolio Health', icon: 'bi-briefcase' },
  { id: 'goal', label: 'Goal Planner', icon: 'bi-bullseye' },
  { id: 'history', label: 'Verdict History', icon: 'bi-clock-history' },
];

const InvestmentToolkit = ({ ticker }) => {
  const [activeTab, setActiveTab] = useState('compare');
  return (
    <div className="ik-wrap">
      <div className="ik-header">
        <h3><i className="bi bi-tools"></i> Investment Toolkit</h3>
        <p className="ik-sub">Compare picks, scan a basket, plan a goal, review past verdicts.</p>
      </div>
      <div className="ik-tabs">
        {TABS.map((t) => (
          <button
            key={t.id}
            className={`ik-tab ${activeTab === t.id ? 'active' : ''}`}
            onClick={() => setActiveTab(t.id)}
          >
            <i className={`bi ${t.icon}`}></i> {t.label}
          </button>
        ))}
      </div>
      <div className="ik-body">
        {activeTab === 'compare' && <CompareTab ticker={ticker} />}
        {activeTab === 'portfolio' && <PortfolioTab seedTicker={ticker} />}
        {activeTab === 'goal' && <GoalTab />}
        {activeTab === 'history' && <HistoryTab />}
      </div>
    </div>
  );
};

const CompareTab = ({ ticker }) => {
  const [a, setA] = useState(ticker || '');
  const [b, setB] = useState('');
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  const run = async () => {
    if (!a || !b) {
      setError('Both tickers required.');
      return;
    }
    setLoading(true);
    setError(null);
    setData(null);
    try {
      const res = await fetch(`${BACKEND_API}/agents/compare/${encodeURIComponent(a)}/${encodeURIComponent(b)}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.detail || json.error || 'compare failed');
      setData(json);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <div className="ik-form-row">
        <input className="ik-input" placeholder="Ticker A" value={a} onChange={(e) => setA(e.target.value.toUpperCase())} />
        <span className="ik-vs">vs</span>
        <input className="ik-input" placeholder="Ticker B" value={b} onChange={(e) => setB(e.target.value.toUpperCase())} />
        <button className="ik-btn" onClick={run} disabled={loading}>
          {loading ? <><i className="bi bi-arrow-repeat ik-spin"></i> Running…</> : <><i className="bi bi-play-circle"></i> Compare</>}
        </button>
      </div>
      {error && <div className="ik-error">{error}</div>}
      {data && (
        <div className="ik-compare-grid">
          <CompareCard pipeline={data.a} />
          <CompareCard pipeline={data.b} />
        </div>
      )}
      {loading && <div className="ik-info">Two full pipelines run in parallel — typically 60-180s.</div>}
    </div>
  );
};

const CompareCard = ({ pipeline }) => {
  const v = pipeline?.verdict || {};
  return (
    <div className="ik-compare-card">
      <h4>{pipeline.stock_name || pipeline.ticker}</h4>
      <div className="ik-compare-rating">{v.rating || '—'}</div>
      <div className="ik-compare-row">CMP: ₹{pipeline.current_price ?? '—'}</div>
      <div className="ik-compare-row">Target: ₹{v.target_price ?? '—'}</div>
      <div className="ik-compare-row">Stop-loss: ₹{v.stop_loss ?? '—'}</div>
      <div className="ik-compare-row">Confidence: {v.confidence ?? '—'}</div>
      <div className="ik-compare-row">Horizon: {v.time_horizon ?? '—'}</div>
      {v.executive_summary && <p className="ik-compare-summary">{v.executive_summary}</p>}
    </div>
  );
};

const PortfolioTab = ({ seedTicker }) => {
  const [tickers, setTickers] = useState(seedTicker || '');
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  const run = async () => {
    const arr = tickers.split(/[,\s]+/).map((t) => t.trim().toUpperCase()).filter(Boolean);
    if (arr.length === 0) { setError('Enter at least one ticker.'); return; }
    if (arr.length > 10) { setError('Max 10 tickers per scan.'); return; }
    setLoading(true);
    setError(null);
    setData(null);
    try {
      const res = await fetch(`${BACKEND_API}/agents/portfolio/health`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tickers: arr }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.detail || json.error || 'portfolio scan failed');
      setData(json);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <div className="ik-form-row">
        <input
          className="ik-input ik-input-wide"
          placeholder="RELIANCE, TCS, HDFCBANK, …"
          value={tickers}
          onChange={(e) => setTickers(e.target.value)}
        />
        <button className="ik-btn" onClick={run} disabled={loading}>
          {loading ? <><i className="bi bi-arrow-repeat ik-spin"></i> Scanning…</> : <><i className="bi bi-clipboard-check"></i> Scan</>}
        </button>
      </div>
      {error && <div className="ik-error">{error}</div>}
      {loading && <div className="ik-info">Each ticker triggers a full pipeline. 5 in parallel — ~3-5 min for a full basket.</div>}
      {data && (
        <>
          <div className="ik-port-summary">
            <div><span className="ik-port-key">Total</span><span className="ik-port-val">{data.summary.count}</span></div>
            <div><span className="ik-port-key">Buys</span><span className="ik-port-val ik-green">{data.summary.actionable_buys}</span></div>
            <div><span className="ik-port-key">Sells</span><span className="ik-port-val ik-red">{data.summary.actionable_sells}</span></div>
            <div><span className="ik-port-key">Avg conf.</span><span className="ik-port-val">{data.summary.avg_confidence ?? '—'}</span></div>
          </div>
          <table className="ik-port-table">
            <thead>
              <tr><th>Ticker</th><th>Rating</th><th>CMP</th><th>Target</th><th>Stop</th><th>Conf.</th></tr>
            </thead>
            <tbody>
              {Object.entries(data.results).map(([t, r]) => {
                const v = r.verdict || {};
                return (
                  <tr key={t}>
                    <td>{t}</td>
                    <td><span className={`ik-rating-pill r-${(v.rating || '').toLowerCase().replace(/\s+/g, '-')}`}>{v.rating || '—'}</span></td>
                    <td>₹{r.current_price ?? '—'}</td>
                    <td>₹{v.target_price ?? '—'}</td>
                    <td>₹{v.stop_loss ?? '—'}</td>
                    <td>{v.confidence ?? '—'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </>
      )}
    </div>
  );
};

const GoalTab = () => {
  const [target, setTarget] = useState(10000000);
  const [years, setYears] = useState(15);
  const [inflation, setInflation] = useState(6);
  const [equity, setEquity] = useState('');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const run = async () => {
    setLoading(true);
    setError(null);
    setData(null);
    try {
      const body = {
        target_corpus: Number(target),
        horizon_years: Number(years),
        inflation_pct: Number(inflation),
      };
      if (equity !== '') body.equity_pct = Number(equity);
      const res = await fetch(`${BACKEND_API}/agents/goal/plan`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.detail || json.error || 'goal plan failed');
      setData(json);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <div className="ik-goal-form">
        <label>Target corpus (₹)<input type="number" value={target} onChange={(e) => setTarget(e.target.value)} /></label>
        <label>Horizon (years)<input type="number" value={years} onChange={(e) => setYears(e.target.value)} /></label>
        <label>Inflation %<input type="number" value={inflation} onChange={(e) => setInflation(e.target.value)} /></label>
        <label>Equity % (optional)<input type="number" value={equity} placeholder="auto" onChange={(e) => setEquity(e.target.value)} /></label>
        <button className="ik-btn" onClick={run} disabled={loading}>
          <i className="bi bi-calculator"></i> {loading ? 'Planning…' : 'Plan'}
        </button>
      </div>
      {error && <div className="ik-error">{error}</div>}
      {data && (
        <div className="ik-goal-result">
          <div className="ik-goal-grid">
            <div><span>Inflation-adjusted target</span><strong>₹{Number(data.real_target_corpus).toLocaleString('en-IN')}</strong></div>
            <div><span>Allocation</span><strong>{data.equity_pct}% Equity / {data.debt_pct}% Debt</strong></div>
            <div><span>Expected blended return</span><strong>{data.expected_return_pct}%</strong></div>
            <div><span>Required monthly SIP</span><strong className="ik-green">₹{Number(data.monthly_sip_required).toLocaleString('en-IN', { maximumFractionDigits: 0 })}</strong></div>
            <div><span>Or one-shot lump-sum</span><strong className="ik-green">₹{Number(data.lumpsum_required).toLocaleString('en-IN', { maximumFractionDigits: 0 })}</strong></div>
          </div>
          <ul className="ik-goal-notes">
            {data.notes.map((n, i) => <li key={i}>{n}</li>)}
          </ul>
        </div>
      )}
    </div>
  );
};

const HistoryTab = () => {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${BACKEND_API}/agents/history?limit=50`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.detail || json.error || 'history failed');
      setRows(json.rows || []);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  return (
    <div>
      <div className="ik-form-row">
        <button className="ik-btn ik-btn-light" onClick={load} disabled={loading}>
          <i className="bi bi-arrow-clockwise"></i> {loading ? 'Loading…' : 'Refresh'}
        </button>
      </div>
      {error && <div className="ik-error">{error}</div>}
      {rows.length === 0 && !loading && <p className="ik-empty">No verdicts logged yet — run an Investment Committee analysis to populate.</p>}
      {rows.length > 0 && (
        <table className="ik-port-table">
          <thead>
            <tr><th>When</th><th>Ticker</th><th>Rating</th><th>Target</th><th>Stop</th><th>Conf.</th><th>Elapsed</th></tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td>{(r.created_at || '').replace('T', ' ').slice(0, 16)}</td>
                <td>{r.ticker}</td>
                <td><span className={`ik-rating-pill r-${(r.rating || '').toLowerCase().replace(/\s+/g, '-')}`}>{r.rating || '—'}</span></td>
                <td>₹{r.target_price ?? '—'}</td>
                <td>₹{r.stop_loss ?? '—'}</td>
                <td>{r.confidence ?? '—'}</td>
                <td>{r.elapsed_sec ? `${r.elapsed_sec}s` : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
};

export default InvestmentToolkit;

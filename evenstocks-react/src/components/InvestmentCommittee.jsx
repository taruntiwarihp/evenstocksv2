import React, { useEffect, useRef, useState } from 'react';
import '../styles/InvestmentCommittee.css';

const BACKEND_API = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

const AGENT_META = {
  fundamentals: { label: 'Fundamentals', icon: 'bi-bank', color: '#02634d', group: 'analyst' },
  technical: { label: 'Technical', icon: 'bi-graph-up', color: '#2563eb', group: 'analyst' },
  news: { label: 'News', icon: 'bi-newspaper', color: '#b45309', group: 'analyst' },
  sentiment: { label: 'Sentiment', icon: 'bi-emoji-smile', color: '#7c3aed', group: 'analyst' },
  sebi_redflag: { label: 'SEBI Red-Flags', icon: 'bi-shield-exclamation', color: '#9f1239', group: 'analyst' },
  macro: { label: 'Macro-India', icon: 'bi-globe-asia-australia', color: '#0f766e', group: 'analyst' },
  concall: { label: 'Concall Summary', icon: 'bi-mic', color: '#9333ea', group: 'analyst' },
  bull: { label: 'Bull Researcher', icon: 'bi-arrow-up-right-circle', color: '#16a34a', group: 'debate' },
  bear: { label: 'Bear Researcher', icon: 'bi-arrow-down-right-circle', color: '#dc2626', group: 'debate' },
  research_manager: { label: 'Research Manager', icon: 'bi-person-badge', color: '#0891b2', group: 'debate' },
  risk_aggressive: { label: 'Aggressive Risk', icon: 'bi-lightning-charge', color: '#ea580c', group: 'risk' },
  risk_conservative: { label: 'Conservative Risk', icon: 'bi-shield-check', color: '#0369a1', group: 'risk' },
  risk_neutral: { label: 'Neutral Risk', icon: 'bi-balance', color: '#6b7280', group: 'risk' },
  risk_manager: { label: 'Chief Risk Officer', icon: 'bi-person-badge-fill', color: '#be185d', group: 'risk' },
  portfolio_manager: { label: 'Portfolio Manager', icon: 'bi-briefcase-fill', color: '#7c2d12', group: 'pm' },
};

const GROUPS = [
  { id: 'analyst', label: 'Analyst Team', agents: ['fundamentals', 'technical', 'news', 'sentiment', 'sebi_redflag', 'macro', 'concall'] },
  { id: 'debate', label: 'Bull vs Bear Debate', agents: ['bull', 'bear', 'research_manager'] },
  { id: 'risk', label: 'Risk Committee', agents: ['risk_aggressive', 'risk_conservative', 'risk_neutral', 'risk_manager'] },
  { id: 'pm', label: 'Final Verdict', agents: ['portfolio_manager'] },
];

const RATING_STYLE = {
  'Strong Buy': { bg: '#065f46', fg: '#d1fae5' },
  'Accumulate': { bg: '#047857', fg: '#d1fae5' },
  'Hold': { bg: '#6b7280', fg: '#f3f4f6' },
  'Reduce': { bg: '#b45309', fg: '#fef3c7' },
  'Sell': { bg: '#b91c1c', fg: '#fee2e2' },
};

const InvestmentCommittee = ({ ticker }) => {
  const [status, setStatus] = useState('idle'); // idle | running | done | error
  const [agentStates, setAgentStates] = useState({}); // { [name]: { status, report, round } }
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('verdict'); // verdict | debate | risk | analysts
  const [activeRiskTab, setActiveRiskTab] = useState('risk_aggressive');
  const eventSourceRef = useRef(null);

  useEffect(() => {
    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
    };
  }, []);

  const runAnalysis = () => {
    if (!ticker) return;
    setStatus('running');
    setError(null);
    setResult(null);
    setAgentStates({});

    if (eventSourceRef.current) eventSourceRef.current.close();

    const url = `${BACKEND_API}/agents/analyze/${encodeURIComponent(ticker)}/stream`;
    const es = new EventSource(url);
    eventSourceRef.current = es;

    es.addEventListener('pipeline_started', () => {});

    es.addEventListener('agent_started', (e) => {
      try {
        const { agent, round } = JSON.parse(e.data);
        setAgentStates((prev) => ({
          ...prev,
          [agentKey(agent, round)]: { status: 'running', round, agent },
        }));
      } catch {}
    });

    es.addEventListener('agent_completed', (e) => {
      try {
        const { agent, round, report, error: agentError } = JSON.parse(e.data);
        setAgentStates((prev) => ({
          ...prev,
          [agentKey(agent, round)]: {
            status: agentError ? 'error' : 'done',
            round,
            agent,
            report,
            error: agentError,
          },
        }));
      } catch {}
    });

    es.addEventListener('result', (e) => {
      try {
        const data = JSON.parse(e.data);
        setResult(data);
        setStatus('done');
      } catch (err) {
        setError('Failed to parse result');
        setStatus('error');
      }
      es.close();
      eventSourceRef.current = null;
    });

    es.addEventListener('error', (e) => {
      let msg = 'Stream failed';
      try {
        if (e.data) msg = JSON.parse(e.data).message || msg;
      } catch {}
      // native EventSource error events have no .data — only treat as terminal if we haven't received result
      if (!result) {
        setError(msg);
        setStatus('error');
      }
      es.close();
      eventSourceRef.current = null;
    });
  };

  if (status === 'idle') {
    return (
      <section className="sd-card ic-cta-card">
        <div className="ic-cta-inner">
          <div className="ic-cta-text">
            <h3 className="ic-cta-title">
              <i className="bi bi-people-fill"></i> AI Investment Committee
            </h3>
            <p className="ic-cta-sub">
              11-agent analysis: 4 analysts research, Bull and Bear debate, 3 risk views clash, and the PM delivers a final Indian-market verdict with tax-aware target + stop-loss.
            </p>
          </div>
          <button className="ic-cta-btn" onClick={runAnalysis}>
            <i className="bi bi-magic"></i> Convene Committee
          </button>
        </div>
      </section>
    );
  }

  if (status === 'error' && !result) {
    return (
      <section className="sd-card ic-error-card">
        <h3><i className="bi bi-exclamation-triangle"></i> Analysis failed</h3>
        <p className="ic-error-msg">{error}</p>
        <button className="ic-cta-btn" onClick={runAnalysis}>Retry</button>
      </section>
    );
  }

  const verdict = result?.verdict || {};
  const rating = verdict.rating || null;
  const ratingStyle = RATING_STYLE[rating] || RATING_STYLE.Hold;

  return (
    <section className="sd-card ic-result-card">
      {/* Live progress — always visible during streaming */}
      <CommitteeProgress agentStates={agentStates} />

      {/* Verdict header (once PM completes) */}
      {rating && (
        <div className="ic-verdict-header">
          <div className="ic-verdict-badge" style={{ background: ratingStyle.bg, color: ratingStyle.fg }}>
            {rating}
          </div>
          {verdict.confidence != null && (
            <div className="ic-confidence">
              <span className="ic-conf-label">Confidence</span>
              <span className="ic-conf-value">{verdict.confidence}%</span>
            </div>
          )}
          <button className="ic-rerun-btn" onClick={runAnalysis} title="Re-run">
            <i className="bi bi-arrow-clockwise"></i>
          </button>
        </div>
      )}

      {/* Verdict metrics */}
      {rating && (
        <div className="ic-verdict-metrics">
          {verdict.target_price != null && (
            <Metric label="Target" value={`₹${formatPrice(verdict.target_price)}`} color="green" />
          )}
          {verdict.stop_loss != null && (
            <Metric label="Stop-loss" value={`₹${formatPrice(verdict.stop_loss)}`} color="red" />
          )}
          {verdict.time_horizon && (
            <Metric label="Horizon" value={verdict.time_horizon} />
          )}
        </div>
      )}

      {/* Tabs */}
      {status === 'done' && result && (
        <>
          <div className="ic-tabs">
            <TabBtn id="verdict" active={activeTab} onClick={setActiveTab}>Verdict</TabBtn>
            <TabBtn id="debate" active={activeTab} onClick={setActiveTab}>Bull vs Bear</TabBtn>
            <TabBtn id="risk" active={activeTab} onClick={setActiveTab}>Risk Committee</TabBtn>
            <TabBtn id="analysts" active={activeTab} onClick={setActiveTab}>Analyst Reports</TabBtn>
          </div>

          <div className="ic-tab-body">
            {activeTab === 'verdict' && <VerdictTab verdict={verdict} />}
            {activeTab === 'debate' && <DebateTab debate={result.debate || {}} />}
            {activeTab === 'risk' && (
              <RiskTab
                views={result.risk_views || {}}
                final={result.risk_final}
                activeRiskTab={activeRiskTab}
                onRiskTabChange={setActiveRiskTab}
              />
            )}
            {activeTab === 'analysts' && <AnalystsTab reports={result.analyst_reports || {}} />}
          </div>
        </>
      )}

      {result?.elapsed_sec != null && status === 'done' && (
        <p className="ic-elapsed">Committee session: {result.elapsed_sec}s</p>
      )}
    </section>
  );
};


/* ─── Subcomponents ─── */

const TabBtn = ({ id, active, onClick, children }) => (
  <button className={`ic-tab-btn ${active === id ? 'active' : ''}`} onClick={() => onClick(id)}>
    {children}
  </button>
);

const Metric = ({ label, value, color }) => (
  <div className="ic-metric">
    <span className="ic-metric-label">{label}</span>
    <span className={`ic-metric-value ${color === 'green' ? 'ic-green' : color === 'red' ? 'ic-red' : ''}`}>
      {value}
    </span>
  </div>
);

const CommitteeProgress = ({ agentStates }) => (
  <div className="ic-progress">
    {GROUPS.map((group) => (
      <div key={group.id} className="ic-progress-group">
        <div className="ic-progress-label">{group.label}</div>
        <div className="ic-progress-chips">
          {group.agents.map((agentName) => {
            const meta = AGENT_META[agentName];
            // Collect all rounds for this agent
            const entries = Object.entries(agentStates).filter(([key, v]) => v.agent === agentName);
            if (entries.length === 0) {
              return <AgentChip key={agentName} meta={meta} status="pending" />;
            }
            return entries.map(([key, val]) => (
              <AgentChip
                key={key}
                meta={meta}
                status={val.status}
                round={val.round}
              />
            ));
          })}
        </div>
      </div>
    ))}
  </div>
);

const AgentChip = ({ meta, status, round }) => {
  if (!meta) return null;
  const statusIcon = {
    pending: <span className="ic-chip-dot" />,
    running: <i className="bi bi-three-dots ic-chip-pulse" />,
    done: <i className="bi bi-check-circle-fill" style={{ color: meta.color }} />,
    error: <i className="bi bi-exclamation-circle-fill" style={{ color: '#f87171' }} />,
  }[status];

  return (
    <div className={`ic-chip ic-chip-${status}`}>
      <i className={`bi ${meta.icon}`} style={{ color: meta.color }}></i>
      <span className="ic-chip-label">
        {meta.label}
        {round != null && round > 1 && <span className="ic-chip-round"> · R{round}</span>}
      </span>
      {statusIcon}
    </div>
  );
};

const VerdictTab = ({ verdict }) => {
  if (!verdict || (!verdict.rating && !verdict.raw)) {
    return <p className="ic-empty">Verdict unavailable.</p>;
  }
  if (verdict.raw) {
    return <pre className="ic-analyst-report">{verdict.raw}</pre>;
  }

  return (
    <>
      {verdict.executive_summary && (
        <p className="ic-exec-summary">{verdict.executive_summary}</p>
      )}
      <div className="ic-thesis-risks">
        {verdict.thesis && verdict.thesis.length > 0 && (
          <div className="ic-thesis">
            <h4><i className="bi bi-check-circle ic-green"></i> Investment thesis</h4>
            <ul>{verdict.thesis.map((t, i) => <li key={i}>{t}</li>)}</ul>
          </div>
        )}
        {verdict.risks && verdict.risks.length > 0 && (
          <div className="ic-risks">
            <h4><i className="bi bi-shield-exclamation ic-red"></i> Key risks</h4>
            <ul>{verdict.risks.map((r, i) => <li key={i}>{r}</li>)}</ul>
          </div>
        )}
      </div>
      {verdict.after_tax_projection?.available && (
        <AfterTaxBlock projection={verdict.after_tax_projection} />
      )}
    </>
  );
};

const AfterTaxBlock = ({ projection }) => (
  <div className="ic-aftertax">
    <h4><i className="bi bi-calculator ic-tax"></i> After-tax projection ({projection.holding_type})</h4>
    <div className="ic-aftertax-grid">
      <div>
        <span className="ic-aftertax-label">Pre-tax return</span>
        <span className="ic-aftertax-value">{projection.pre_tax_return_pct}%</span>
      </div>
      <div>
        <span className="ic-aftertax-label">Post-tax return</span>
        <span className="ic-aftertax-value ic-green">{projection.post_tax_return_pct}%</span>
      </div>
      <div>
        <span className="ic-aftertax-label">Tax drag</span>
        <span className="ic-aftertax-value ic-red">{projection.tax_drag_pct}%</span>
      </div>
      <div>
        <span className="ic-aftertax-label">Effective rate</span>
        <span className="ic-aftertax-value">{projection.effective_tax_rate_pct}%</span>
      </div>
    </div>
    {projection.notes?.length > 0 && (
      <ul className="ic-aftertax-notes">
        {projection.notes.map((n, i) => <li key={i}>{n}</li>)}
      </ul>
    )}
  </div>
);

const DebateTab = ({ debate }) => {
  const bullRounds = debate.bull_history || [];
  const bearRounds = debate.bear_history || [];
  const research = debate.research_view;

  if (bullRounds.length === 0 && bearRounds.length === 0) {
    return <p className="ic-empty">Debate not available.</p>;
  }

  const maxRounds = Math.max(bullRounds.length, bearRounds.length);

  return (
    <div className="ic-debate-wrap">
      {Array.from({ length: maxRounds }).map((_, i) => (
        <div key={i} className="ic-debate-round">
          <div className="ic-debate-round-label">Round {i + 1}</div>
          <div className="ic-debate-pair">
            {bullRounds[i] && (
              <div className="ic-debate-card ic-debate-bull">
                <div className="ic-debate-head">
                  <i className="bi bi-arrow-up-right-circle"></i> Bull
                </div>
                <div className="ic-debate-body">{bullRounds[i]}</div>
              </div>
            )}
            {bearRounds[i] && (
              <div className="ic-debate-card ic-debate-bear">
                <div className="ic-debate-head">
                  <i className="bi bi-arrow-down-right-circle"></i> Bear
                </div>
                <div className="ic-debate-body">{bearRounds[i]}</div>
              </div>
            )}
          </div>
        </div>
      ))}

      {research && (
        <div className="ic-research-view">
          <h4><i className="bi bi-person-badge"></i> Research Manager's synthesis</h4>
          <pre className="ic-analyst-report">{research}</pre>
        </div>
      )}
    </div>
  );
};

const RiskTab = ({ views, final, activeRiskTab, onRiskTabChange }) => {
  const riskOrder = [
    { id: 'risk_aggressive', label: 'Aggressive' },
    { id: 'risk_conservative', label: 'Conservative' },
    { id: 'risk_neutral', label: 'Neutral' },
  ];

  return (
    <div className="ic-risk-wrap">
      <div className="ic-risk-tabs">
        {riskOrder.map((r) => (
          <button
            key={r.id}
            className={`ic-risk-tab ic-risk-tab-${r.id.replace('risk_', '')} ${activeRiskTab === r.id ? 'active' : ''}`}
            onClick={() => onRiskTabChange(r.id)}
          >
            {r.label}
          </button>
        ))}
      </div>
      <div className="ic-risk-body">
        <pre className="ic-analyst-report">{views[activeRiskTab] || 'No view available.'}</pre>
      </div>
      {final && (
        <div className="ic-risk-final">
          <h4><i className="bi bi-person-badge-fill"></i> CRO's final rating</h4>
          <pre className="ic-analyst-report">{final}</pre>
        </div>
      )}
    </div>
  );
};

const AnalystsTab = ({ reports }) => {
  const [expanded, setExpanded] = useState(null);
  return (
    <div className="ic-analyst-list">
      {Object.entries(reports).map(([key, report]) => {
        const meta = AGENT_META[key] || { label: key, icon: 'bi-person', color: '#6b7280' };
        const isOpen = expanded === key;
        return (
          <div key={key} className={`ic-analyst-row ${isOpen ? 'open' : ''}`}>
            <button className="ic-analyst-toggle" onClick={() => setExpanded(isOpen ? null : key)}>
              <i className={`bi ${meta.icon}`} style={{ color: meta.color }}></i>
              <span>{meta.label}</span>
              <i className={`bi bi-chevron-${isOpen ? 'up' : 'down'}`}></i>
            </button>
            {isOpen && <pre className="ic-analyst-report">{report}</pre>}
          </div>
        );
      })}
    </div>
  );
};


/* ─── Helpers ─── */
function agentKey(agent, round) {
  return round != null ? `${agent}:${round}` : agent;
}

function formatPrice(p) {
  if (typeof p === 'number') return p.toLocaleString('en-IN', { maximumFractionDigits: 2 });
  return p;
}

export default InvestmentCommittee;

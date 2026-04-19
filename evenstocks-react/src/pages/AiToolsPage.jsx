import React, { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import Header from '../components/Header';
import Footer from '../components/Footer';
import InvestmentCommittee from '../components/InvestmentCommittee';
import InvestmentToolkit from '../components/InvestmentToolkit';
import { useTheme } from '../context/ThemeContext';
import '../styles/AiToolsPage.css';

const AiToolsPage = () => {
  const { isDark } = useTheme();
  const navigate = useNavigate();
  const [params] = useSearchParams();

  const initialTicker = (params.get('ticker') || '').toUpperCase();
  const [ticker, setTicker] = useState(initialTicker);
  const [submittedTicker, setSubmittedTicker] = useState(initialTicker);

  const submit = (e) => {
    e.preventDefault();
    const t = ticker.trim().toUpperCase();
    if (t) setSubmittedTicker(t);
  };

  return (
    <div className={`sd-page ${isDark ? 'dark' : 'light'} ai-tools-page`}>
      <Header />
      <main className="ai-tools-main">
        <section className="ai-tools-hero">
          <div>
            <h1><i className="bi bi-cpu"></i> AI Investment Tools</h1>
            <p>Run the full Investment Committee on any Indian stock, compare picks, scan a basket, plan a goal, and review every past verdict — all in one place.</p>
          </div>
          <button className="ai-tools-back" onClick={() => navigate(-1)}>← Back</button>
        </section>

        <section className="ai-tools-section">
          <h2><i className="bi bi-people-fill"></i> Run AI Investment Committee</h2>
          <p className="ai-tools-help">Type any NSE/BSE ticker. The committee runs 9 AI agents (analysts → debate → risk → verdict).</p>
          <form className="ai-tools-tickerform" onSubmit={submit}>
            <input
              className="ai-tools-input"
              placeholder="e.g. RELIANCE, TCS, HDFCBANK"
              value={ticker}
              onChange={(e) => setTicker(e.target.value.toUpperCase())}
              autoFocus
            />
            <button type="submit" className="ai-tools-runbtn">
              <i className="bi bi-play-circle-fill"></i> Load Committee
            </button>
          </form>
          {submittedTicker ? (
            <InvestmentCommittee key={submittedTicker} ticker={submittedTicker} />
          ) : (
            <div className="ai-tools-placeholder">
              <i className="bi bi-arrow-up-circle"></i>
              <p>Enter a ticker above to load the Investment Committee.</p>
            </div>
          )}
        </section>

        <section className="ai-tools-section">
          <h2><i className="bi bi-tools"></i> Investment Toolkit</h2>
          <p className="ai-tools-help">Compare two stocks, scan a basket, plan a corpus goal, or review past verdicts.</p>
          <InvestmentToolkit ticker={submittedTicker} />
        </section>
      </main>
      <Footer />
    </div>
  );
};

export default AiToolsPage;

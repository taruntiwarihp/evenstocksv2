What each phase added (2 lines each)

Phase 1 — Core Committee

Added FastAPI agents service with 4 analysts (Fundamentals, Technical, News, Sentiment) + Portfolio Manager producing a structured Buy/Hold/Sell verdict.
Wired Node proxy + React Investment Committee panel on the Stock Detail page.
Phase 2 — Debate + Risk + Live Streaming

Added Bull vs Bear researchers + Research Manager debate, and 3-way Risk team (Aggressive / Conservative / Neutral) + Chief Risk Officer.
Converted pipeline to SSE streaming so the UI shows each agent light up live across 4 tabs (Verdict, Debate, Risk, Analysts).
Phase 3 — Real Data + SEBI Flags

Replaced news/sentiment stubs with live Google News + Yahoo Finance RSS and Reddit (5 Indian investing subs).
Added a new SEBI red-flag analyst that mines cons + financials for governance warnings (pledged shares, low RoE, CFO-vs-PAT divergence, etc.).
Phase 4 — Tax + Macro + Concall

Added Indian tax engine (post-Jul-2024 STCG 20% / LTCG 12.5% above ₹1.25L) and injected after-tax projection into every Portfolio Manager verdict.
Added Macro-India analyst (RBI / CPI / FII / USD-INR / Brent) and Concall Summarizer (management guidance + brokerage scorecard).
Phase 5 — Toolkit

Added Compare (two-ticker side-by-side), Portfolio Health (basket scan, up to 10 tickers parallel), Goal Planner (SIP/lumpsum corpus calc) and Verdict History (SQLite-backed, logged on every run).
Built Investment Toolkit React panel with 4 tabs exposing all four tools on the Stock Detail page.

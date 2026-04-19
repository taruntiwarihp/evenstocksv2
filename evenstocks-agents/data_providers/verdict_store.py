"""SQLite store for past Investment Committee verdicts.

Lives in its own DB file (separate from the read-only stocks.db) so we can
write freely without contention. Used for:
  - /history endpoint (recent verdicts list)
  - Future backtest engine (verdict vs. realised price move)
  - Audit trail
"""

import json
import logging
import os
import sqlite3
from datetime import datetime
from typing import Optional

log = logging.getLogger(__name__)

DEFAULT_PATH = os.getenv("VERDICT_DB_PATH", "/app/data/verdicts.db")


def _conn(db_path: Optional[str] = None) -> sqlite3.Connection:
    path = db_path or DEFAULT_PATH
    os.makedirs(os.path.dirname(path), exist_ok=True)
    conn = sqlite3.connect(path, check_same_thread=False)
    conn.row_factory = sqlite3.Row
    return conn


def init(db_path: Optional[str] = None) -> None:
    with _conn(db_path) as c:
        c.execute("""
        CREATE TABLE IF NOT EXISTS verdicts (
            id            INTEGER PRIMARY KEY AUTOINCREMENT,
            ticker        TEXT NOT NULL,
            stock_name    TEXT,
            rating        TEXT,
            confidence    REAL,
            target_price  REAL,
            stop_loss     REAL,
            time_horizon  TEXT,
            current_price REAL,
            elapsed_sec   REAL,
            created_at    TEXT NOT NULL,
            verdict_json  TEXT,
            error         TEXT
        )
        """)
        c.execute("CREATE INDEX IF NOT EXISTS idx_verdicts_ticker ON verdicts(ticker, created_at DESC)")
        c.execute("CREATE INDEX IF NOT EXISTS idx_verdicts_created ON verdicts(created_at DESC)")
        c.commit()


def log_verdict(pipeline_result: dict, db_path: Optional[str] = None) -> Optional[int]:
    """Persist a single pipeline result. Returns row id or None on failure."""
    try:
        init(db_path)
        verdict = pipeline_result.get("verdict") or {}
        with _conn(db_path) as c:
            cur = c.execute(
                """INSERT INTO verdicts
                   (ticker, stock_name, rating, confidence, target_price, stop_loss,
                    time_horizon, current_price, elapsed_sec, created_at, verdict_json, error)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                (
                    pipeline_result.get("ticker"),
                    pipeline_result.get("stock_name"),
                    verdict.get("rating") if isinstance(verdict, dict) else None,
                    verdict.get("confidence") if isinstance(verdict, dict) else None,
                    _num(verdict.get("target_price") if isinstance(verdict, dict) else None),
                    _num(verdict.get("stop_loss") if isinstance(verdict, dict) else None),
                    verdict.get("time_horizon") if isinstance(verdict, dict) else None,
                    _num(pipeline_result.get("current_price")),
                    pipeline_result.get("elapsed_sec"),
                    datetime.utcnow().isoformat(),
                    json.dumps(verdict, default=str) if verdict else None,
                    pipeline_result.get("error") or pipeline_result.get("verdict_error"),
                ),
            )
            c.commit()
            return cur.lastrowid
    except Exception as exc:
        log.warning("verdict log failed: %s", exc)
        return None


def list_recent(limit: int = 50, ticker: Optional[str] = None, db_path: Optional[str] = None) -> list[dict]:
    init(db_path)
    with _conn(db_path) as c:
        if ticker:
            rows = c.execute(
                "SELECT * FROM verdicts WHERE UPPER(ticker)=? ORDER BY created_at DESC LIMIT ?",
                (ticker.upper(), limit),
            ).fetchall()
        else:
            rows = c.execute(
                "SELECT * FROM verdicts ORDER BY created_at DESC LIMIT ?",
                (limit,),
            ).fetchall()
        return [dict(r) for r in rows]


def _num(val) -> Optional[float]:
    if val is None:
        return None
    if isinstance(val, (int, float)):
        return float(val)
    s = str(val).replace(",", "").replace("₹", "").strip()
    if not s or s in {"-", "—", "N/A"}:
        return None
    try:
        return float(s)
    except ValueError:
        return None

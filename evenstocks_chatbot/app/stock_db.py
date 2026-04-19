"""
stock_db.py — Search and fetch stock data from stocks.db
"""

import os
import json
import sqlite3

DB_PATH = os.path.join("data", "stocks.db")


def get_conn() -> sqlite3.Connection | None:
    if not os.path.exists(DB_PATH):
        return None
    conn = sqlite3.connect(DB_PATH, check_same_thread=False)
    conn.row_factory = sqlite3.Row
    return conn


def search_stocks(conn: sqlite3.Connection, query: str, limit: int = 20) -> list[dict]:
    """Fuzzy search stocks by name. Returns list of {stock_name, url, market_cap}.
    Empty query returns all stocks (limited). Case- and separator-insensitive: 'tatamotors',
    'Tata Motors', 'TATA_MOTORS' all match 'Tata_Motors'."""
    q = query.strip().lower().replace(" ", "").replace("_", "").replace(".", "").replace("-", "")
    rows = conn.execute(
        """SELECT stock_name, url, market_cap, current_price, stock_pe
           FROM company_info
           WHERE REPLACE(REPLACE(REPLACE(LOWER(stock_name), '_', ''), '-', ''), '.', '') LIKE ?
           ORDER BY
             CASE
               WHEN REPLACE(REPLACE(REPLACE(LOWER(stock_name), '_', ''), '-', ''), '.', '') = ? THEN 0
               WHEN REPLACE(REPLACE(REPLACE(LOWER(stock_name), '_', ''), '-', ''), '.', '') LIKE ? THEN 1
               ELSE 2
             END,
             stock_name
           LIMIT ?""",
        (f"%{q}%", q, f"{q}%", limit),
    ).fetchall()
    return [dict(r) for r in rows]


def get_company_info(conn: sqlite3.Connection, stock_name: str) -> dict | None:
    row = conn.execute(
        "SELECT * FROM company_info WHERE stock_name = ?", (stock_name,)
    ).fetchone()
    if not row:
        return None
    d = dict(row)
    # Parse JSON fields
    for key in ("pros", "cons"):
        if d.get(key):
            try:
                d[key] = json.loads(d[key])
            except Exception:
                pass
    return d


def get_financial_tables(conn: sqlite3.Connection, stock_name: str) -> dict:
    rows = conn.execute(
        "SELECT table_type, data FROM financial_tables WHERE stock_name = ?",
        (stock_name,),
    ).fetchall()
    tables = {}
    for r in rows:
        try:
            tables[r["table_type"]] = json.loads(r["data"])
        except Exception:
            tables[r["table_type"]] = []
    return tables


def get_pdf_texts(conn: sqlite3.Connection, stock_name: str) -> list[dict]:
    try:
        rows = conn.execute(
            """SELECT doc_type, title, text FROM pdf_texts
               WHERE stock_name = ? AND text != ''
               ORDER BY doc_type, doc_index""",
            (stock_name,),
        ).fetchall()
        return [dict(r) for r in rows]
    except sqlite3.OperationalError:
        return []


def build_stock_context(conn: sqlite3.Connection, stock_name: str) -> str | None:
    """Build a full text context block for Claude from all stock data."""
    info = get_company_info(conn, stock_name)
    if not info:
        return None

    parts = []
    parts.append(f"# {stock_name.replace('_', ' ')}")
    parts.append(f"URL: {info.get('url', '')}\n")

    # Key metrics
    parts.append("## Key Metrics")
    for key in ("market_cap", "current_price", "high_low", "stock_pe",
                 "book_value", "dividend_yield", "roce", "roe", "face_value"):
        val = info.get(key, "")
        if val:
            label = key.replace("_", " ").title()
            parts.append(f"- {label}: {val}")

    # About
    if info.get("about"):
        parts.append(f"\n## About\n{info['about']}")

    # Pros / Cons
    for section in ("pros", "cons"):
        items = info.get(section, [])
        if items and isinstance(items, list):
            parts.append(f"\n## {section.title()}")
            for item in items:
                parts.append(f"- {item}")

    # Financial tables
    tables = get_financial_tables(conn, stock_name)
    for table_type, data in tables.items():
        if not data:
            continue
        parts.append(f"\n## {table_type.replace('-', ' ').title()}")
        # Convert table rows to readable text
        rows = data if isinstance(data, list) and data and isinstance(data[0], dict) else []
        if not rows and isinstance(data, list) and data and isinstance(data[0], list):
            # nested tables — flatten first one
            rows = data[0] if data[0] and isinstance(data[0][0], dict) else []
        for row in rows[:20]:  # limit rows to keep context manageable
            line = " | ".join(f"{k}: {v}" for k, v in row.items() if v)
            parts.append(line)

    # PDF document texts (trimmed)
    pdf_texts = get_pdf_texts(conn, stock_name)
    for doc in pdf_texts[:4]:  # limit documents
        doc_type = doc["doc_type"].replace("_", " ").title()
        title = doc["title"]
        text = doc["text"][:3000]  # trim long texts
        parts.append(f"\n## Document: {doc_type} — {title}")
        parts.append(text)

    return "\n".join(parts)

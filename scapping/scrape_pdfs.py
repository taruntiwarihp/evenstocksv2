"""
scrape_pdfs.py
────────────────────────────────────────────────────────────────
Script 2: Downloads document PDFs from each stock's screener.in page.
  - Announcements, Annual Reports, Credit Ratings, Concalls
  - PDFs saved to: documents/{Stock_Name}/
  - Extracted PDF text saved to SQLite: data/stocks.db → pdf_texts table

Run scrape_tables.py first (or independently — this works standalone too).

Usage:
  python scrape_pdfs.py
  python scrape_pdfs.py --start 0 --end 100
  python scrape_pdfs.py --max-docs 10       # max PDFs per category

Requires: pip install requests beautifulsoup4 PyMuPDF
"""

import os
import re
import json
import csv
import time
import random
import sqlite3
import logging
import argparse
import traceback
from urllib.parse import urljoin

import requests
from bs4 import BeautifulSoup
import fitz  # PyMuPDF

# ═══════════════════════════════════════════════════════════════
INPUT_CSV       = "screener_stocks.csv"
DOCUMENTS_DIR   = "documents"
DB_PATH         = os.path.join("data", "stocks.db")
LOGIN_URL       = "https://www.screener.in/login/"
LOGIN_EMAIL     = "taruntiwari.hp@gmail.com"
LOGIN_PASSWORD  = "Tiwari2000@20"

MIN_DELAY         = 1.5
MAX_DELAY         = 3.0
REQUEST_TIMEOUT   = 30
SKIP_IF_PRESENT   = True
MAX_DOCS_PER_TYPE = 5

DOCUMENT_SECTIONS = [
    ("documents flex-column", "announcements"),
    ("documents annual-reports flex-column", "annual_reports"),
    ("documents credit-ratings flex-column", "credit_ratings"),
    ("documents concalls flex-column", "concalls"),
]

LOG_FILE = "scrape_pdfs.log"
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  %(levelname)-8s  %(message)s",
    handlers=[
        logging.FileHandler(LOG_FILE, encoding="utf-8"),
        logging.StreamHandler(),
    ],
)
log = logging.getLogger(__name__)

WEB_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/123.0.0.0 Safari/537.36"
    ),
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Referer": "https://www.screener.in/",
}


# ═══════════════════════════════════════════════════════════════
# SQLite (for storing extracted PDF text)
# ═══════════════════════════════════════════════════════════════
def init_db(db_path: str) -> sqlite3.Connection:
    os.makedirs(os.path.dirname(db_path), exist_ok=True)
    conn = sqlite3.connect(db_path)
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("""
        CREATE TABLE IF NOT EXISTS pdf_texts (
            stock_name TEXT,
            doc_type   TEXT,
            doc_index  INTEGER,
            title      TEXT,
            url        TEXT,
            filename   TEXT,
            text       TEXT,
            PRIMARY KEY (stock_name, doc_type, doc_index)
        )
    """)
    conn.commit()
    return conn


def pdfs_exist(conn: sqlite3.Connection, stock_name: str) -> bool:
    row = conn.execute(
        "SELECT 1 FROM pdf_texts WHERE stock_name = ? LIMIT 1", (stock_name,)
    ).fetchone()
    return row is not None


# ═══════════════════════════════════════════════════════════════
# Helpers
# ═══════════════════════════════════════════════════════════════
def clean_name(name: str) -> str:
    return name.strip().replace(" ", "_").replace(".", "")


def create_session() -> requests.Session:
    session = requests.Session()
    session.headers.update(WEB_HEADERS)
    try:
        resp = session.get(LOGIN_URL, timeout=REQUEST_TIMEOUT)
        soup = BeautifulSoup(resp.content, "html.parser")
        csrf = soup.find("input", {"name": "csrfmiddlewaretoken"})
        if csrf:
            resp = session.post(
                LOGIN_URL,
                data={
                    "username": LOGIN_EMAIL,
                    "password": LOGIN_PASSWORD,
                    "csrfmiddlewaretoken": csrf["value"],
                },
                headers={**WEB_HEADERS, "Referer": LOGIN_URL},
                timeout=REQUEST_TIMEOUT,
            )
            if resp.status_code == 200 and "login" not in resp.url:
                log.info("Logged in successfully.")
            else:
                log.warning("Login may have failed.")
        else:
            log.warning("CSRF token not found.")
    except Exception as e:
        log.warning(f"Login error: {e}")
    return session


# ═══════════════════════════════════════════════════════════════
# Document discovery
# ═══════════════════════════════════════════════════════════════
def find_document_links(soup: BeautifulSoup, base_url: str,
                        max_per_type: int) -> dict[str, list[dict]]:
    doc_links: dict[str, list[dict]] = {}

    for css_class, doc_type in DOCUMENT_SECTIONS:
        links = []
        section = soup.find("div", class_=lambda c: c and css_class in c)
        if section:
            for a in section.find_all("a", href=True):
                href = a["href"].strip()
                if not href:
                    continue
                full_url = urljoin(base_url, href)
                title = a.get_text(strip=True) or doc_type
                links.append({"url": full_url, "title": title})

        doc_links[doc_type] = links[:max_per_type]

    return doc_links


# ═══════════════════════════════════════════════════════════════
# Download & extract
# ═══════════════════════════════════════════════════════════════
def download_file(session: requests.Session, url: str, save_path: str) -> bool:
    try:
        resp = session.get(url, timeout=REQUEST_TIMEOUT, stream=True)
        if resp.status_code != 200:
            log.warning(f"    HTTP {resp.status_code}: {url}")
            return False
        with open(save_path, "wb") as f:
            for chunk in resp.iter_content(8192):
                f.write(chunk)
        log.info(f"    Downloaded: {os.path.basename(save_path)}")
        return True
    except Exception as e:
        log.error(f"    Download error: {url} — {e}")
        return False


def extract_pdf_text(pdf_path: str) -> str:
    """Extract all text from PDF, return as single cleaned string."""
    try:
        doc = fitz.open(pdf_path)
        all_text = []
        for page in doc:
            raw = page.get_text("text")
            cleaned = re.sub(r"\s+", " ", raw).strip()
            all_text.append(cleaned)
        doc.close()
        return "\n\n".join(all_text)
    except Exception as e:
        log.debug(f"    PDF read error: {pdf_path} — {e}")
        return ""


# ═══════════════════════════════════════════════════════════════
# Per-company pipeline
# ═══════════════════════════════════════════════════════════════
def process_company(session: requests.Session, conn: sqlite3.Connection,
                    name: str, url: str, max_docs: int) -> bool:
    stock_name = clean_name(name)
    comp_dir = os.path.join(DOCUMENTS_DIR, stock_name)

    if SKIP_IF_PRESENT and pdfs_exist(conn, stock_name):
        log.info(f"  [skip] {stock_name}")
        return True

    log.info(f"  Processing: {stock_name}")
    time.sleep(random.uniform(MIN_DELAY, MAX_DELAY))

    try:
        resp = session.get(url, timeout=REQUEST_TIMEOUT)
        if resp.status_code != 200:
            log.warning(f"  HTTP {resp.status_code} for {stock_name}")
            return False
        soup = BeautifulSoup(resp.content, "html.parser")
    except Exception as e:
        log.error(f"  Fetch failed for {stock_name}: {e}")
        return False

    doc_links = find_document_links(soup, url, max_docs)
    os.makedirs(comp_dir, exist_ok=True)

    total_downloaded = 0

    for doc_type, links in doc_links.items():
        for i, info in enumerate(links):
            doc_url = info["url"]
            title = info.get("title", f"{doc_type}_{i}")

            # Determine extension
            ext = doc_url.rsplit(".", 1)[-1].split("?")[0].split("&")[0].lower()
            if ext not in ("pdf", "png", "jpg", "jpeg", "docx", "ppt", "xml", "txt"):
                ext = "pdf"

            safe_title = re.sub(r"[^\w\-]", "_", title)[:60]
            filename = f"{doc_type}_{i}_{safe_title}.{ext}"
            save_path = os.path.join(comp_dir, filename)

            # Download
            if os.path.exists(save_path):
                downloaded = True
            else:
                time.sleep(random.uniform(0.3, 1.0))
                downloaded = download_file(session, doc_url, save_path)

            # Extract text from PDF
            text = ""
            if downloaded and ext == "pdf" and os.path.exists(save_path):
                text = extract_pdf_text(save_path)

            if downloaded:
                total_downloaded += 1

            # Save to SQLite
            conn.execute("""
                INSERT OR REPLACE INTO pdf_texts
                (stock_name, doc_type, doc_index, title, url, filename, text)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            """, (stock_name, doc_type, i, title, doc_url, filename, text))

    conn.commit()

    if total_downloaded > 0:
        log.info(f"  Saved {total_downloaded} docs for {stock_name}")
    else:
        log.info(f"  No documents found for {stock_name}")

    return True


# ═══════════════════════════════════════════════════════════════
# Main
# ═══════════════════════════════════════════════════════════════
def main():
    parser = argparse.ArgumentParser(description="Download stock PDFs → documents/")
    parser.add_argument("--start", type=int, default=0)
    parser.add_argument("--end", type=int, default=None)
    parser.add_argument("--max-docs", type=int, default=MAX_DOCS_PER_TYPE,
                        help="Max PDFs per document category (default 5)")
    args = parser.parse_args()

    stocks = []
    with open(INPUT_CSV, "r", encoding="utf-8") as f:
        for row in csv.DictReader(f):
            stocks.append(row)

    end = min(args.end or len(stocks), len(stocks))
    start = max(0, args.start)

    log.info("=" * 60)
    log.info(f"PDF Scraper  |  {len(stocks)} total  |  [{start}:{end}]")
    log.info("=" * 60)

    os.makedirs(DOCUMENTS_DIR, exist_ok=True)
    conn = init_db(DB_PATH)
    session = create_session()
    ok = fail = 0
    t0 = time.time()

    for i in range(start, end):
        name, url = stocks[i]["name"], stocks[i]["url"]
        try:
            if process_company(session, conn, name, url, args.max_docs):
                ok += 1
            else:
                fail += 1
        except Exception as e:
            log.error(f"  [{i}] {name}: {e}\n{traceback.format_exc()}")
            fail += 1

        if (i - start + 1) % 50 == 0:
            log.info(f"\n=== Progress: {i - start + 1}/{end - start} | OK: {ok} | Fail: {fail} ===\n")

    conn.close()
    elapsed = time.time() - t0
    log.info(f"\nDone in {elapsed:.0f}s  |  OK: {ok}  |  Failed: {fail}")
    log.info(f"PDFs in: {DOCUMENTS_DIR}/  |  Text in: {DB_PATH}")


if __name__ == "__main__":
    main()

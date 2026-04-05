"""
scrape_stock_data.py
────────────────────────────────────────────────────────────────
Reads screener_stocks.csv, visits each stock's screener.in page:
  1. Extracts company info (market cap, PE, ROCE, etc.)
  2. Extracts financial tables (quarters, P&L, balance sheet,
     cash flow, ratios, shareholding) → saved as JSON
  3. Downloads document PDFs (announcements, annual reports,
     credit ratings, concalls) → saved under documents/{stock}/
  4. Extracts text from downloaded PDFs → included in JSON

Output:
  - documents/{Stock_Name}/          ← PDF files
  - data/stock_data/{Stock_Name}.json ← all structured data

Usage:
  python scrape_stock_data.py
  python scrape_stock_data.py --start 100 --end 200   # process a slice
  python scrape_stock_data.py --threads 8              # parallel workers

Requires:
  pip install requests beautifulsoup4 html5lib pandas PyMuPDF
"""

import os
import re
import json
import csv
import time
import random
import logging
import argparse
import traceback
from urllib.parse import urljoin

import requests
from bs4 import BeautifulSoup
import fitz  # PyMuPDF

# ═══════════════════════════════════════════════════════════════
# Configuration
# ═══════════════════════════════════════════════════════════════
INPUT_CSV      = "screener_stocks.csv"
DOCUMENTS_DIR  = "documents"
DATA_DIR       = os.path.join("data", "stock_data")
LOGIN_URL      = "https://www.screener.in/login/"

# Credentials (same as get_stocks.py)
LOGIN_EMAIL    = "taruntiwari.hp@gmail.com"
LOGIN_PASSWORD = "Tiwari2000@20"

MAX_THREADS      = 4
MIN_DELAY         = 1.5
MAX_DELAY         = 3.0
REQUEST_TIMEOUT   = 30
SKIP_IF_PRESENT   = False  # set True to skip companies whose JSON already has tables
MAX_DOCS_PER_TYPE = 5      # max PDFs to download per document category

LOG_FILE = "scrape_stock_data.log"
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

# Document section CSS classes on screener.in
DOCUMENT_SECTIONS = [
    ("documents flex-column", "announcements"),
    ("documents annual-reports flex-column", "annual_reports"),
    ("documents credit-ratings flex-column", "credit_ratings"),
    ("documents concalls flex-column", "concalls"),
]

# Financial table section IDs on screener.in
TABLE_SECTIONS = [
    "quarters", "profit-loss", "balance-sheet",
    "cash-flow", "ratios", "shareholding",
]

FILE_EXT_RE = re.compile(
    r"\.(pdf|png|jpg|jpeg|docx|mp4|txt|ppt|xml)$", re.IGNORECASE
)


# ═══════════════════════════════════════════════════════════════
# Helpers
# ═══════════════════════════════════════════════════════════════
def clean_name(name: str) -> str:
    return name.strip().replace(" ", "_").replace(".", "")


def create_session() -> requests.Session:
    """Create a requests.Session and log in to screener.in."""
    session = requests.Session()
    session.headers.update(WEB_HEADERS)

    try:
        resp = session.get(LOGIN_URL, timeout=REQUEST_TIMEOUT)
        soup = BeautifulSoup(resp.content, "html.parser")
        csrf_input = soup.find("input", {"name": "csrfmiddlewaretoken"})

        if csrf_input:
            login_data = {
                "username": LOGIN_EMAIL,
                "password": LOGIN_PASSWORD,
                "csrfmiddlewaretoken": csrf_input["value"],
            }
            resp = session.post(
                LOGIN_URL, data=login_data, timeout=REQUEST_TIMEOUT,
                headers={**WEB_HEADERS, "Referer": LOGIN_URL},
            )
            if resp.status_code == 200 and "login" not in resp.url:
                log.info("Logged in to screener.in successfully.")
            else:
                log.warning("Login may have failed — some data might be restricted.")
        else:
            log.warning("CSRF token not found — proceeding without login.")
    except Exception as e:
        log.warning(f"Login error: {e}  — proceeding without login.")

    return session


# ═══════════════════════════════════════════════════════════════
# Company info extraction
# ═══════════════════════════════════════════════════════════════
def extract_company_info(soup: BeautifulSoup) -> dict:
    """Extract key metrics from the top of the company page."""
    info = {}

    # About section
    about = soup.find("div", class_=lambda c: c and "about" in c)
    if about:
        info["about"] = about.get_text(" ", strip=True)

    # Numbered ratios (Market Cap, Current Price, ...)
    metric_keys = [
        "market_cap", "current_price", "high_low", "stock_pe",
        "book_value", "dividend_yield", "roce", "roe", "face_value",
    ]
    spans = soup.find_all("span", class_="nowrap value")
    for i, key in enumerate(metric_keys):
        if i < len(spans):
            info[key] = "".join(spans[i].get_text().split())

    # Pros / Cons
    for cls in ("pros", "cons"):
        div = soup.find("div", class_=cls)
        if div:
            info[cls] = [li.get_text(strip=True) for li in div.find_all("li")]

    return info


# ═══════════════════════════════════════════════════════════════
# Table extraction
# ═══════════════════════════════════════════════════════════════
def _parse_html_table(table_tag) -> list[dict] | None:
    """Parse a single <table> into a list-of-dicts (row-oriented)."""
    if not table_tag:
        return None

    header_row = table_tag.find("tr")
    if not header_row:
        return None

    headers = [el.get_text(strip=True)
               for el in header_row.find_all(["th", "td"]) if el.get_text(strip=True)]
    if not headers:
        return None

    rows = []
    for tr in table_tag.find_all("tr")[1:]:
        cells = tr.find_all(["td", "th"])
        if not cells:
            continue
        vals = [c.get_text(strip=True) for c in cells]
        # Sometimes the row label is an extra first cell
        if len(vals) == len(headers) + 1:
            headers = [""] + headers
        if len(vals) != len(headers):
            continue
        rows.append(dict(zip(headers, vals)))

    return rows if rows else None


def extract_tables(soup: BeautifulSoup) -> dict:
    """Extract all financial tables from the company page."""
    tables = {}

    for section_id in TABLE_SECTIONS:
        if section_id == "shareholding":
            container = soup.find("div", {"id": "quarterly-shp"})
        else:
            container = soup.find("section", {"id": section_id})

        if not container:
            tables[section_id] = []
            continue

        section_tables = []
        for tbl in container.find_all("table"):
            parsed = _parse_html_table(tbl)
            if parsed:
                section_tables.append(parsed)

        # Flatten if there's only one table in the section
        if len(section_tables) == 1:
            tables[section_id] = section_tables[0]
        else:
            tables[section_id] = section_tables

    return tables


# ═══════════════════════════════════════════════════════════════
# Document discovery & downloading
# ═══════════════════════════════════════════════════════════════
def find_document_links(soup: BeautifulSoup, base_url: str) -> dict[str, list[dict]]:
    """Find PDF / document download links from the company page."""
    doc_links: dict[str, list[dict]] = {}

    for css_class, doc_type in DOCUMENT_SECTIONS:
        links = []
        # screener uses space-separated classes
        section = soup.find("div", class_=lambda c: c and css_class in c)
        if section:
            for a in section.find_all("a", href=True):
                href = a["href"].strip()
                if not href:
                    continue
                full_url = urljoin(base_url, href)
                title = a.get_text(strip=True) or doc_type
                links.append({"url": full_url, "title": title})

        doc_links[doc_type] = links[:MAX_DOCS_PER_TYPE]

    return doc_links


def download_file(session: requests.Session, url: str, save_path: str) -> bool:
    """Download a single file. Returns True on success."""
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


def download_documents(
    session: requests.Session,
    doc_links: dict[str, list[dict]],
    comp_dir: str,
) -> dict[str, list[dict]]:
    """Download all documents, return metadata with local paths."""
    os.makedirs(comp_dir, exist_ok=True)
    results: dict[str, list[dict]] = {}

    for doc_type, links in doc_links.items():
        entries = []
        for i, info in enumerate(links):
            url = info["url"]
            title = info.get("title", f"{doc_type}_{i}")

            # Determine extension
            ext = url.rsplit(".", 1)[-1].split("?")[0].split("&")[0].lower()
            if ext not in ("pdf", "png", "jpg", "jpeg", "docx", "ppt", "xml", "txt"):
                ext = "pdf"

            safe_title = re.sub(r"[^\w\-]", "_", title)[:60]
            filename = f"{doc_type}_{i}_{safe_title}.{ext}"
            save_path = os.path.join(comp_dir, filename)

            if os.path.exists(save_path):
                downloaded = True
            else:
                time.sleep(random.uniform(0.3, 1.0))
                downloaded = download_file(session, url, save_path)

            entry = {
                "url": url,
                "title": title,
                "file": filename,
                "downloaded": downloaded,
            }
            entries.append(entry)

        results[doc_type] = entries

    return results


# ═══════════════════════════════════════════════════════════════
# PDF text extraction
# ═══════════════════════════════════════════════════════════════
def extract_pdf_text(pdf_path: str) -> list[str]:
    """Return one cleaned string per page."""
    try:
        doc = fitz.open(pdf_path)
        pages = []
        for page in doc:
            raw = page.get_text("text")
            cleaned = re.sub(r"\s+", " ", raw).strip()
            pages.append(cleaned)
        doc.close()
        return pages
    except Exception as e:
        log.debug(f"    PDF read error: {pdf_path} — {e}")
        return []


def add_pdf_texts(doc_results: dict[str, list[dict]], comp_dir: str) -> None:
    """Mutate doc_results to include extracted text for each downloaded PDF."""
    for doc_type, entries in doc_results.items():
        for entry in entries:
            if not entry.get("downloaded"):
                continue
            fpath = os.path.join(comp_dir, entry["file"])
            if fpath.lower().endswith(".pdf") and os.path.exists(fpath):
                entry["text_pages"] = extract_pdf_text(fpath)


# ═══════════════════════════════════════════════════════════════
# Per-company pipeline
# ═══════════════════════════════════════════════════════════════
def process_company(session: requests.Session, name: str, url: str) -> bool:
    """Fetch page, extract everything, download docs, save JSON."""
    comp_name = clean_name(name)
    comp_dir  = os.path.join(DOCUMENTS_DIR, comp_name)
    json_path = os.path.join(DATA_DIR, f"{comp_name}.json")

    # Skip if already complete
    if SKIP_IF_PRESENT and os.path.exists(json_path):
        try:
            with open(json_path, encoding="utf-8") as f:
                existing = json.load(f)
            if existing.get("company_info") and existing.get("tables"):
                log.info(f"  [skip] {comp_name}")
                return True
        except Exception:
            pass

    log.info(f"  Processing: {comp_name}")

    # Polite delay
    time.sleep(random.uniform(MIN_DELAY, MAX_DELAY))

    # Fetch company page
    try:
        resp = session.get(url, timeout=REQUEST_TIMEOUT)
        if resp.status_code != 200:
            log.warning(f"  HTTP {resp.status_code} for {comp_name}")
            return False
        soup = BeautifulSoup(resp.content, "html.parser")
    except Exception as e:
        log.error(f"  Fetch failed for {comp_name}: {e}")
        return False

    result: dict = {"name": name, "url": url}

    # 1) Company info
    result["company_info"] = extract_company_info(soup)

    # 2) Financial tables → JSON
    result["tables"] = extract_tables(soup)

    # 3) Discover document links
    doc_links = find_document_links(soup, url)

    # 4) Download documents (PDFs, etc.)
    result["documents"] = download_documents(session, doc_links, comp_dir)

    # 5) Extract text from downloaded PDFs
    add_pdf_texts(result["documents"], comp_dir)

    # Save JSON
    os.makedirs(DATA_DIR, exist_ok=True)
    with open(json_path, "w", encoding="utf-8") as f:
        json.dump(result, f, ensure_ascii=False, indent=2)

    log.info(f"  Saved: {json_path}")
    return True


# ═══════════════════════════════════════════════════════════════
# Sequential runner
# ═══════════════════════════════════════════════════════════════
def main():
    parser = argparse.ArgumentParser(description="Scrape stock data from screener.in")
    parser.add_argument("--start", type=int, default=0, help="Start index (0-based)")
    parser.add_argument("--end", type=int, default=None, help="End index (exclusive)")
    args = parser.parse_args()

    # Read stock list
    stocks = []
    with open(INPUT_CSV, "r", encoding="utf-8") as f:
        for row in csv.DictReader(f):
            stocks.append(row)

    end = args.end if args.end is not None else len(stocks)
    end = min(end, len(stocks))
    start = max(0, args.start)

    log.info("=" * 60)
    log.info(f"Stock Data Scraper  |  {len(stocks)} total  |  processing [{start}:{end}]")
    log.info("=" * 60)

    os.makedirs(DOCUMENTS_DIR, exist_ok=True)
    os.makedirs(DATA_DIR, exist_ok=True)

    session = create_session()
    ok = fail = 0
    t0 = time.time()

    for i in range(start, end):
        name, url = stocks[i]["name"], stocks[i]["url"]
        try:
            if process_company(session, name, url):
                ok += 1
            else:
                fail += 1
        except Exception as e:
            log.error(f"  [{i}] {name}: {e}\n{traceback.format_exc()}")
            fail += 1

        if (i - start + 1) % 50 == 0:
            log.info(
                f"\n=== Progress: {i - start + 1}/{end - start} "
                f"| OK: {ok} | Fail: {fail} ===\n"
            )

    elapsed = time.time() - t0
    log.info(f"\nDone in {elapsed:.0f}s  |  OK: {ok}  |  Failed: {fail}")


if __name__ == "__main__":
    main()

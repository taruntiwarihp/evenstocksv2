"""
screener_scraper.py
────────────────────────────────────────────────────────────────
- Checks if already logged in before attempting login form
- Auto-logs in only when actually needed
- CSV saved every 10 pages

Usage:    python screener_scraper.py
Requires: pip install selenium webdriver-manager beautifulsoup4
"""

import csv
import sys
import time
import random
import logging
from pathlib import Path
from datetime import datetime

from selenium import webdriver
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.common.exceptions import (
    TimeoutException, WebDriverException, NoSuchElementException
)
from webdriver_manager.chrome import ChromeDriverManager
from bs4 import BeautifulSoup

# ══════════════════════════════════════════════════════════════
BASE_URL      = "https://www.screener.in/screens/71064/all-stocks/"
LOGIN_URL     = "https://www.screener.in/login/"
TOTAL_PAGES   = 107
LIMIT         = 50
OUTPUT_CSV    = "screener_stocks.csv"
LOG_FILE      = "screener_scraper.log"
MIN_DELAY     = 1.5
MAX_DELAY     = 4.5
TABLE_TIMEOUT = 30
SAVE_EVERY    = 10

LOGIN_EMAIL    = "taruntiwari.hp@gmail.com"
LOGIN_PASSWORD = "Tiwari2000@20"
# ══════════════════════════════════════════════════════════════

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  %(levelname)-8s  %(message)s",
    handlers=[
        logging.FileHandler(LOG_FILE, encoding="utf-8"),
        logging.StreamHandler(),
    ],
)
log = logging.getLogger(__name__)


# ── Driver ──────────────────────────────────────────────────────
def build_driver() -> webdriver.Chrome:
    opts = Options()
    opts.add_argument("--incognito")
    opts.add_argument("--window-size=1440,900")
    opts.add_argument("--no-sandbox")
    opts.add_argument("--disable-dev-shm-usage")
    opts.add_argument("--disable-gpu")
    opts.add_argument("--disable-software-rasterizer")
    opts.add_argument("--remote-debugging-port=9222")
    opts.add_argument("--disable-extensions")
    opts.add_argument("--no-first-run")
    opts.add_argument("--disable-blink-features=AutomationControlled")
    opts.add_experimental_option("excludeSwitches", ["enable-automation"])
    opts.add_experimental_option("useAutomationExtension", False)
    opts.add_argument(
        "--user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/123.0.0.0 Safari/537.36"
    )
    service = Service(ChromeDriverManager().install())
    driver  = webdriver.Chrome(service=service, options=opts)
    driver.execute_cdp_cmd(
        "Page.addScriptToEvaluateOnNewDocument",
        {"source": "Object.defineProperty(navigator, 'webdriver', {get: () => undefined})"},
    )
    return driver


# ── Login ────────────────────────────────────────────────────────
def already_logged_in(driver: webdriver.Chrome) -> bool:
    """True if the current page shows a logged-in session (no login form present)."""
    return (
        "login" not in driver.current_url
        and driver.find_elements(By.CSS_SELECTOR, "input[name='username']") == []
    )


def fill_login_form(driver: webdriver.Chrome) -> bool:
    """Fill and submit the login form. Returns True on success."""
    try:
        wait = WebDriverWait(driver, 15)
        email_field = wait.until(
            EC.presence_of_element_located((By.CSS_SELECTOR, "input[name='username']"))
        )
        email_field.clear()
        email_field.send_keys(LOGIN_EMAIL)
        time.sleep(0.4)

        pass_field = driver.find_element(By.CSS_SELECTOR, "input[name='password']")
        pass_field.clear()
        pass_field.send_keys(LOGIN_PASSWORD)
        time.sleep(0.4)

        driver.find_element(
            By.CSS_SELECTOR, "button[type='submit'], input[type='submit']"
        ).click()

        # Wait until redirected away from the login page
        WebDriverWait(driver, 15).until(lambda d: "login" not in d.current_url)
        time.sleep(2)
        return True

    except (TimeoutException, NoSuchElementException) as e:
        driver.save_screenshot("debug_login_fail.png")
        log.error(f"Login form error: {e}  →  debug_login_fail.png")
        return False


def ensure_logged_in(driver: webdriver.Chrome) -> bool:
    """
    Navigate to login URL.
    - If already redirected to feed/home → already logged in, skip form.
    - If login form appears → fill it in.
    """
    log.info("Checking login status …")
    driver.get(LOGIN_URL)
    time.sleep(3)

    if already_logged_in(driver):
        log.info("✅  Already logged in — skipping login form.")
        return True

    log.info("Login form detected — filling credentials …")
    success = fill_login_form(driver)
    if success:
        log.info("✅  Logged in successfully!")
    return success


# ── Fetch one page ───────────────────────────────────────────────
def fetch_page(driver: webdriver.Chrome, page: int) -> BeautifulSoup | None:
    url = f"{BASE_URL}?limit={LIMIT}&page={page}"
    try:
        driver.get(url)

        # Session dropped mid-scrape
        if "login" in driver.current_url:
            log.warning(f"Page {page}: session expired — re-logging in …")
            if not ensure_logged_in(driver):
                return None
            driver.get(url)

        for selector in [
            "tr[data-row-company-id]",
            "table.data-table tbody tr",
            "table tbody tr",
        ]:
            try:
                WebDriverWait(driver, TABLE_TIMEOUT).until(
                    EC.presence_of_element_located((By.CSS_SELECTOR, selector))
                )
                html = driver.page_source
                log.info(f"Page {page:>3}  →  OK  ({len(html):,} chars)")
                return BeautifulSoup(html, "html.parser")
            except TimeoutException:
                continue

        driver.save_screenshot(f"debug_fail_page{page}.png")
        log.warning(f"Page {page}: table not found — screenshot saved")
        return None

    except WebDriverException as e:
        log.error(f"Page {page}: {e.msg}")
    return None


# ── Parse ────────────────────────────────────────────────────────
def parse_stocks(soup: BeautifulSoup, page: int) -> list[dict]:
    stocks = []

    rows = soup.find_all("tr", attrs={"data-row-company-id": True})
    if not rows:
        table = soup.find("table", class_=lambda c: c and "data-table" in c)
        if table:
            rows = table.find_all("tr")

    for row in rows:
        a = row.find("a", href=lambda h: h and "/company/" in h)
        if a:
            href = a["href"].strip()
            stocks.append({
                "name": a.get_text(strip=True),
                "url": f"https://www.screener.in{href}" if href.startswith("/") else href,
            })

    if not stocks:
        log.warning(f"Page {page}: 0 stocks parsed")
    return stocks


# ── CSV ──────────────────────────────────────────────────────────
def save_csv(stocks: list[dict], path: str) -> None:
    with open(path, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=["name", "url"])
        writer.writeheader()
        writer.writerows(stocks)
    log.info(f"💾  CSV saved → {path}  ({len(stocks):,} records)")


# ── Scrape loop ──────────────────────────────────────────────────
def scrape_all(driver: webdriver.Chrome) -> list[dict]:
    all_stocks: list[dict] = []
    failed_pages: list[int] = []

    log.info(f"Scraping {TOTAL_PAGES} pages  |  CSV updated every {SAVE_EVERY} pages\n")

    for page in range(1, TOTAL_PAGES + 1):
        soup = fetch_page(driver, page)

        if soup is None:
            failed_pages.append(page)
        else:
            stocks = parse_stocks(soup, page)
            all_stocks.extend(stocks)
            log.info(f"  → {len(stocks):>2} stocks  (total: {len(all_stocks):,})")

        # Flush CSV every SAVE_EVERY pages and on the last page
        if page % SAVE_EVERY == 0 or page == TOTAL_PAGES:
            save_csv(all_stocks, OUTPUT_CSV)

        if page < TOTAL_PAGES:
            delay = random.uniform(MIN_DELAY, MAX_DELAY)
            log.info(f"  Sleeping {delay:.2f} s …")
            time.sleep(delay)

    if failed_pages:
        log.warning(f"Failed pages: {failed_pages}")

    return all_stocks


# ── Entry ────────────────────────────────────────────────────────
if __name__ == "__main__":
    start = datetime.now()
    log.info("=" * 60)
    log.info(f"Screener.in scraper  —  {start:%Y-%m-%d %H:%M:%S}")
    log.info("=" * 60)

    driver = build_driver()
    try:
        if not ensure_logged_in(driver):
            log.error("Could not log in. Exiting.")
            sys.exit(1)

        results = scrape_all(driver)

        elapsed = (datetime.now() - start).total_seconds()
        log.info(f"\n✅  Done in {elapsed:.1f} s  —  {len(results):,} stocks total")

    finally:
        driver.quit()
        log.info("Browser closed.")
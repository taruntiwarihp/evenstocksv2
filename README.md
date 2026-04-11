# EvenStocks - AI-Powered Stock Analysis Platform

EvenStocks scrapes Indian stock data from screener.in, stores it in SQLite, and provides an AI chatbot that analyzes stocks using real data — not LLM training knowledge.

## Features

- Scrapes 5000+ Indian stocks from screener.in (company info, financials, PDFs)
- SQLite database for fast storage and retrieval
- AI chatbot with `@mention` autocomplete to search and tag stocks
- Multi-stock comparison support
- Real-time streaming responses via WebSocket
- Green-themed interactive UI

## Project Structure

```
evenstocksv2/
├── main.py                  # FastAPI entry point
├── app/
│   ├── config.py            # Environment config
│   ├── session.py           # Chat session manager
│   ├── stock_db.py          # SQLite DB helpers
│   └── api/
│       └── chat.py          # WebSocket chat endpoint
├── frontend/
│   ├── index.html           # Main UI
│   ├── logo.png
│   ├── css/styles.css
│   └── js/app.js
├── scapping/
│   ├── get_all_stocks_list.py   # Scrape stock list from screener.in
│   ├── scrape_stock_fundamental.py  # Scrape company info & financial tables
│   └── scrape_pdfs.py          # Download & extract PDFs
├── scrape_tables.py         # Standalone table scraper
├── read_stocks_db.py        # CLI tool to query the database
├── data/
│   └── stocks.db            # SQLite database (generated)
├── screener_stocks.csv      # Stock list (generated)
├── requirements.txt
└── .env                     # API keys & config
```

## Prerequisites

- [Anaconda](https://www.anaconda.com/download) or [Miniconda](https://docs.conda.io/en/latest/miniconda.html)
- Python 3.13+
- Anthropic API key (get one at https://console.anthropic.com)
- screener.in account (for scraping)

## Installation

### Create Conda Environment & Install Dependencies

```bash
conda create -n evenstocks python=3.13 -y
conda activate evenstocks
pip install -r requirements.txt
```

### Configure Environment Variables

Create a `.env` file in the project root:

```bash
ANTHROPIC_API_KEY=your-api-key-here

# Server settings
HOST=0.0.0.0
PORT=8000

# Model settings
MODEL=claude-sonnet-4-20250514
MAX_TOKENS=2048
```

Replace `your-api-key-here` with your actual Anthropic API key.

## Usage

### 4. Run the Chatbot

```bash
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

Open http://localhost:8000 in your browser.

### 5. Query Database (CLI)

```bash
# List all stocks in database
python read_stocks_db.py --list

# View specific stock info
python read_stocks_db.py --stock "Tata_Motors"

# View specific table
python read_stocks_db.py --stock "Infosys" --table financial_tables

# Run custom SQL
python read_stocks_db.py --sql "SELECT stock_name FROM company_info LIMIT 10"

# View PDF texts
python read_stocks_db.py --stock "Reliance" --pdfs
```

## How to Use the Chatbot

1. Open http://localhost:8000
2. Type `@` followed by a stock name (e.g., `@Tata`) to see autocomplete suggestions
3. Select a stock from the dropdown
4. Tag multiple stocks for comparison
5. Type your question and press Enter
6. The AI analyzes using only database data — no hallucinated financial info

## Conda Environment Management

```bash
# Activate environment
conda activate evenstocks

# Deactivate environment
conda deactivate

# Remove environment (if needed)
conda remove -n evenstocks --all

# Export environment
conda env export > environment.yml

# Recreate from export
conda env create -f environment.yml
```

## Troubleshooting

| Issue | Fix |
|-------|-----|
| `ModuleNotFoundError` | Run `conda activate evenstocks` then `pip install -r requirements.txt` |
| Scraper skipping all stocks | Set `SKIP_IF_PRESENT = False` in `scrape_tables.py` |
| `html5lib` parser error | Already fixed — uses built-in `html.parser` |
| Windows encoding errors (₹ symbol) | Not a bug — only affects console display, DB is fine |
| WebSocket connection failed | Ensure the server is running on the correct port |

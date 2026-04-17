# Docker Setup for EvenStocks

This repository now includes Docker support for the main services, using standard Python environments.

## Services

- `frontend` → React app on port `3000`
- `evenstocks-backend` → Node.js proxy on port `5000`
- `evenstocks-api` → Flask API on port `5809`
- `evenstocks-chatbot` → FastAPI chatbot on port `8000`
- `evenstocks-scapping` → Python scraping scripts (profile: scraping)
- `mysql` → MySQL database on port `3307`

## Python Services

The Python services (`evenstocks-api`, `evenstocks-chatbot`, `evenstocks-scapping`) use standard Python environments. Each Dockerfile:
- Uses `python:3.11-slim` base image
- Installs system dependencies as needed
- Installs packages from `requirements.txt` using pip
- Runs the app directly with Python

## Run

1. Copy `.env.example` to `.env` and fill in the secrets.
2. Start the main stack:

```bash
docker compose up --build
```

3. To run scraping (optional, runs stock data collection):

```bash
docker compose --profile scraping up --build
```

4. Open the app in your browser:

- `http://localhost:3000` for the React frontend
- `http://localhost:5000` for backend health
- `http://localhost:5809` for Flask API health
- `http://localhost:8000` for FastAPI health

## Notes

- The MySQL schema is initialized from `evenstocks-api/schema.sql`.
- The React app uses `REACT_APP_API_URL` and `REACT_APP_CHATBOT_WS_URL` from compose.
- The Flask app now supports `DB_HOST`, `DB_USER`, and `DB_PASSWORD` via environment.
- Fill in `ANTHROPIC_API_KEY`, Razorpay credentials, and email credentials before starting.
- Scraping service is in a separate profile to avoid running heavy scraping by default.

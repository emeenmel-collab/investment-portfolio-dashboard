# Portfolio Analytics Dashboard

A browser-based investment portfolio analytics project built with HTML, CSS, JavaScript, and a Cloudflare Worker API proxy. The dashboard supports holdings management, live quote refresh through a provider API, portfolio concentration analytics, historical price reconstruction, SPY daily comparison, local persistence, and CSV export.

## Features

- Portfolio market value, cost basis, unrealized gain/loss, and return
- Editable holdings and add/remove positions
- Allocation chart, largest holding, top-three concentration, and Herfindahl concentration index
- Quote refresh through a server-side API proxy
- Historical price reconstruction for 1M, 3M, 6M, and 1Y windows
- SPY daily benchmark comparison and normalized historical comparison chart
- Local browser persistence and CSV export

## Architecture

- `index.html`: static front end; publish this file with GitHub Pages
- `worker.js`: Cloudflare Worker that calls Finnhub without exposing the API key to the browser

## Setup

1. Create an account with a market-data provider and review its terms, data entitlements, rate limits, and age requirements. This example uses Finnhub.
2. In Cloudflare, create a Worker and paste in `worker.js`.
3. Add a Worker secret named `FINNHUB_API_KEY` containing your provider key. Do not put the key in `index.html`, README, or any public repository file.
4. Deploy the Worker and copy its HTTPS URL.
5. In the dashboard, paste the Worker URL into **Cloudflare Worker base URL** and click **Save URL**.
6. Click **Refresh market prices**. Then click **Load historical analysis** to request historical daily closes.
7. Publish `index.html` and `README.md` from the repository root with GitHub Pages.

## API routes

- `GET /quotes?symbols=AAPL,MSFT,SPY`
- `GET /history?symbols=AAPL,MSFT,SPY&days=30`

The Worker accepts up to 10 symbols per request. It adds basic input validation and response caching, but a public Worker URL is still callable by anyone. Monitor provider usage and consider additional rate limiting before wider public use.

## Data and methodology notes

- Data availability and freshness depend on provider entitlements, market-data licensing, and plan limits. The application must not be described as real-time unless the provider account actually returns real-time data.
- Historical chart values use current share quantities applied to past closing prices. This is a price-only reconstruction, not true historical account performance; it excludes trading activity, deposits/withdrawals, fees, taxes, and dividends.
- The SPY comparison is a benchmark reference, not a personalized investment recommendation.
- Sample prices are illustrative until refreshed successfully.
- This is an educational project, not investment advice.

## Security notes

- Store `FINNHUB_API_KEY` only as a Cloudflare Worker secret.
- Never commit provider keys to GitHub.
- Do not add real brokerage credentials or account login information to this project.
- This starter Worker uses wildcard CORS for simple public GitHub Pages hosting. CORS is not authentication; use provider quotas and platform rate limits to reduce abuse.

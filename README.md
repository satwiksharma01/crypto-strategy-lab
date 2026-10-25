# Crypto Strategy Lab

A focused spot-strategy research workbench: describe a supported rule, inspect exactly what it means, run a historical test, and export a reproducible result.

## Run locally

Requires Node.js 22 or newer. No package installation, exchange credentials, or model API key is required for this first slice.

```text
npm start
```

Open http://127.0.0.1:4321. The server binds only to loopback.

```text
npm test
npm run build
```

`public/` is the complete static site. `npm run build` verifies the assets, snapshot hashes, and real-data execution without bundling dependencies.

## Supported rules

The initial interpreter is a bounded rule parser, **not an LLM**. It recognizes these forms, with editable assets, periods, and thresholds:

```text
Buy BTC when its 10-day moving average crosses above its 30-day moving average; sell on the reverse cross.
Buy ETH when RSI(14) is below 30; sell when RSI is above 70.
Buy and hold BTC.
```

Only BTC/ETH spot, long or cash. Extra conditions are rejected rather than silently ignored. RSI entries/exits use the completed RSI level below/above the reviewed thresholds; SMA entries/exits require actual crosses. Model-based interpretation is a later integration requiring an explicit provider and spend budget.

## Execution and metrics

Completed prior-bar signals execute at the next daily open. Commission and adverse slippage apply on both sides. Entries use a fixed share of available cash, including entry fees; no resizing occurs while held. The final position is sold at the last test close with costs, clearly marked as an end-of-period convention. Fractional fills do not model venue lot sizes, market impact, orderbook depth, or intraday paths.

Net return reconciles with equity and the trade ledger. Net win rate includes both commissions. Slippage is already embedded in execution prices. The buy-and-hold benchmark uses the same allocation, costs, and test dates. Indicator warmup can read preceding snapshot bars. The account starts flat; this release does not claim an unseen holdout, walk-forward validation, or future profitability.

## Historical data and provenance

Fixed 2025 BTCUSDT and ETHUSDT daily snapshots from [Binance Public Data](https://github.com/binance/binance-public-data). The fetch script verifies the provider's SHA-256 for each of 24 monthly ZIP archives. Each normalized JSON file has its own SHA-256 in `public/data/manifest.json`; the UI checks that identity before use.

Public availability and checksum identity are not independent price verification or an endorsement. Quotes and capital are in **USDT**, whose USD value can vary. This is historical research, not a live data feed or trading system. Review data terms for any broader commercial redistribution.

Regenerate the same fixed year (network required):

```text
python scripts/fetch-market-data.py
```

## Reports and sharing

Run results stay in your browser. JSON exports carry strategy, assumptions, data identity, and computed results. Remix links carry inputs only and require a new review and run; they are not permanently stored public performance reports. Export hashes identify bytes, not third-party certification of the model or data.

## Project status and boundaries

This is the first functional slice, not the full AI product. Model interpretation, accounts, durable report hosting, payments, leverage, and live execution are not implemented. The public GitHub repository destination and release license remain to be selected; this local source directory does not imply a published open-source release.

The engine here is original spot code. No Vibe-Trading implementation was copied or relabeled. Upstream research informed next-bar/accounting checks and reporting requirements; preserve applicable licenses if upstream code is incorporated later. Product rationale and handoff notes live in the project's Obsidian vault.

# Crypto Strategy Lab

A focused spot-strategy research workbench: describe a supported rule, inspect exactly what it means, run a historical test, and export a reproducible result.

## Run locally

Requires Node.js 22 or newer. The free browser parser/backtest needs no package installation or API key. The optional local MCP server needs `npm ci --ignore-scripts`.

```text
npm start
```

Open http://127.0.0.1:4321. The server binds only to loopback.

```text
npm test
npm run build
```

`public/` is the static source. `npm run build` verifies the assets, snapshot hashes, and real-data execution, then copies the site to `dist/` without bundling dependencies.

## Supported rules

The free interpreter is a bounded rule parser. It recognizes these forms, with editable assets, periods, and thresholds:

```text
Buy BTC when its 10-day moving average crosses above its 30-day moving average; sell on the reverse cross.
Buy ETH when RSI(14) is below 30; sell when RSI is above 70.
Buy and hold BTC.
```

Only BTC/ETH spot, long or cash. Extra conditions are rejected rather than silently ignored. RSI entries/exits use the completed RSI level below/above the reviewed thresholds; SMA entries/exits require actual crosses.

## Bring your own key or agent

Choose **Gemini · your API key** to interpret flexible descriptions into the same supported rule contract. The browser sends your prompt directly to Google's fixed HTTPS API using your key in a header. The key stays in the current tab, never local/session storage, share URLs, exports, or our server. Clear it when finished; browser scripts/extensions can access an entered key. Requests use your provider account and quota. The model is editable; the default is `gemini-3.5-flash-lite`.

One review click makes one bounded request with a 30-second timeout and no automatic retry. Unsupported or ambiguous strategies must reject; the app validates the returned rule object and still requires human review. Structured output cannot prove that a model preserved every requested condition. Neither the model nor an agent executes generated code.

For **Claude Code or Codex**, use the [local MCP setup](docs/local-agent.md). Four stdio tools expose capabilities, validation, fixed-data backtests, and result preparation. The browser exports a versioned task and imports the matching agent result as JSON; it does not connect to a local HTTP port. Your agent uses its existing model account. A CLI agent's authenticated model session has not been exercised by the automated protocol tests.

For a live development check, copy `.env.example` to the ignored `.env.local`, add your `GEMINI_API_KEY` there, then run:

```text
npm run check:gemini
```

This makes two real Gemini requests (supported SMA and unsupported stop-loss rejection). It prints no keys or raw responses. Never place a developer key in `public/` or deploy it as a shared demo key. No development key was available during initial integration, so mocked adapter tests are separate from live Gemini verification.

Contract and API references: [agent result contract](docs/agent-contract.md), [Google structured output](https://ai.google.dev/gemini-api/docs/structured-output), [Gemini keys](https://ai.google.dev/gemini-api/docs/api-key).

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

This slice includes Gemini BYOK interpretation and a local MCP agent handoff around the supported strategy types. Accounts, durable report hosting, payments, leverage, and live execution are not implemented. The public GitHub repository destination and release license remain to be selected; this local source directory does not imply a published open-source release.

The engine here is original spot code. No Vibe-Trading implementation was copied or relabeled. Upstream research informed next-bar/accounting checks and reporting requirements; preserve applicable licenses if upstream code is incorporated later. Product rationale and handoff notes live in the project's Obsidian vault.

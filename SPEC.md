# First slice: review, test, inspect

The user authorized starting the product on 25 October 2026 and explicitly confirmed BTC/ETH spot, long or flat, on 26 October. Spot is implemented explicitly, rather than relabeling the upstream perpetual engine.

## Deliverable

A usable browser research workbench: strategy → explicit rule review → deterministic daily spot backtest → equity, benchmark, net-of-fee trade ledger, provenance, JSON export, and remixable input URL. The free rule parser recognizes documented forms. The user confirmed on 26 October 2026 that users should bring their own API key or local Claude Code/Codex agent, with Gemini for development.

## Connected interpretation

- Gemini requests go directly from the browser to Google's fixed HTTPS endpoint with a user-entered key in a header. Keys stay in the current tab, never in storage, URLs, exports, reports, or deployment assets. The developer key is used only by a local check, never a public proxy or shared demo credential.
- One explicit review click makes at most one provider request, with a timeout and bounded input/output. No background calls, automatic retries, or strategy optimization.
- Model/agent output must match a versioned task/result contract and existing rule validation. Unsupported or ambiguous requests must reject with explanations. Human review remains required because schema validation cannot establish complete semantic fidelity.
- Local agents use an MCP stdio bridge with supported-rule and fixed-data backtest tools. The browser exports a task and imports the matching result JSON; there is no unauthenticated local HTTP listener or arbitrary code execution.
- Edits or provider changes cancel pending interpretation and invalidate previous reviews/results. Late responses cannot revive a stale review. Imported results are bound to a task UUID, prompt, and market.
- Provenance records interpreter kind/model, not credentials. Remix links restore canonical rule inputs with the free parser; recipients need their own provider connection for fresh AI interpretation.

## Financial contract

- BTCUSDT or ETHUSDT; long or cash; no leverage, borrowing, custody, or live orders.
- SMA crossover, Wilder RSI threshold, and buy-and-hold. Unsupported text is rejected rather than approximated.
- Signals use completed prior bars. Orders fill at the next available daily open with configured adverse slippage.
- Entries spend a fixed fraction of available cash including entry commission; exits liquidate the position. No resizing while held.
- Close remaining positions at the final test close with slippage and commission, explicitly disclosed as a terminal valuation convention.
- Gross P&L and commissions are separate; net P&L and net win rate include both entry and exit commissions. Slippage is embedded in fill prices.
- Benchmark buys at the first evaluation open with the same allocation/costs and closes at the final close.
- Indicator warmup can read earlier bars in the selected snapshot; starts without a position. Invalid/missing/noncontiguous candles fail visibly.
- Fractional fills without exchange lot-size/minimum-order or market-impact modeling; fixed slippage, not orderbook reconstruction.

## Boundaries and implementation

Dependency-free browser ES modules plus a Node built-in local server/test runner. The optional local MCP server uses the official SDK and Zod. No hosted generated-code execution or shared server credentials. Static hosting is suitable for this slice. Runs remain local; sharing a URL shares only strategy inputs. It is not a stored public report service.

`public/core/strategy.mjs` owns rule validation; `public/core/engine.mjs` owns execution/accounting; `public/data/` contains versioned public market snapshots/provenance; the UI owns review and presentation. No upstream implementation code is copied in this slice.

## Verification

`npm test`: independent accounting, timing, validation, benchmark, and data checks. `npm run build`: source/static asset checks. Browser QA: actual review/run/review-invalidation/export/remix, responsive layout, and no fabricated initial performance. Keep unsupported cases and limitations visible.

The open-source GitHub destination/license, final brand, accounts, paid tiers, and durable sharing are later decisions. Provider charges belong to each connected key's account; this app does not enforce an account-wide provider budget. A ready source folder is not a published GitHub repository.

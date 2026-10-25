# First slice: review, test, inspect

The user authorized starting the product on 25 October 2026 and explicitly confirmed BTC/ETH spot, long or flat, on 26 October. Spot is implemented explicitly, rather than relabeling the upstream perpetual engine.

## Deliverable

A usable browser research workbench: supported English strategy → explicit rule review → deterministic daily spot backtest → equity, benchmark, net-of-fee trade ledger, provenance, JSON export, and remixable input URL. The first interpreter recognizes documented rule forms; it is not an LLM and must never be presented as model-powered interpretation. A model provider and spend limit remain needed for that integration.

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

Dependency-free browser ES modules plus a Node built-in local server/test runner. No hosted generated-code execution or shared server credentials. Static hosting is suitable for this slice. Runs remain local; sharing a URL shares only strategy inputs. It is not a stored public report service.

`public/core/strategy.mjs` owns rule validation; `public/core/engine.mjs` owns execution/accounting; `public/data/` contains versioned public market snapshots/provenance; the UI owns review and presentation. No upstream implementation code is copied in this slice.

## Verification

`npm test`: independent accounting, timing, validation, benchmark, and data checks. `npm run build`: source/static asset checks. Browser QA: actual review/run/review-invalidation/export/remix, responsive layout, and no fabricated initial performance. Keep unsupported cases and limitations visible.

The open-source GitHub destination, production model budget, final brand, accounts, paid tiers, and durable sharing are later decisions. A ready source folder is not a published GitHub repository.

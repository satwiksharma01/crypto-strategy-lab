# Connect Claude Code or Codex

Crypto Strategy Lab includes a local MCP server. Your agent can inspect supported rules, validate a strategy, and run the same historical engine used by the web demo. The browser exchanges a task and a result as JSON files; it does not open a connection to your computer. Importing a result requires review before a browser backtest can run.

The MCP server uses stdio and opens no listening port. It reads only the two bundled market snapshots and their manifest. It accepts no file paths, arbitrary code, API keys, or live trading orders. It makes no network requests. Your agent uses its existing model connection and billing; the model processing the exported prompt may be remote, depending on your agent settings.

## Install and connect

Use Node.js 22 or later. Run these commands from the repository root in PowerShell:

```powershell
npm ci --ignore-scripts
$agentScript = (Resolve-Path .\agent\server.mjs).Path
$nodeExecutable = (Get-Command node).Source
```

Choose the client you use:

```powershell
# Claude Code: configuration for this project on your machine
claude mcp add --transport stdio --scope local crypto-strategy-lab -- $nodeExecutable $agentScript
claude mcp get crypto-strategy-lab

# Codex: add a stdio server to your Codex MCP configuration
codex mcp add crypto-strategy-lab -- $nodeExecutable $agentScript
codex mcp list
```

Restart an existing agent session so it discovers the server, then check `/mcp`. Keep the repository at the configured absolute path; if you move it, update the client's server configuration. The app does not run these setup commands or edit your client configuration automatically.

For another shell, use the same command with absolute executable and script paths, quoting paths that contain spaces:

```sh
codex mcp add crypto-strategy-lab -- /absolute/path/to/node /absolute/path/to/crypto-strategy-lab/agent/server.mjs
claude mcp add --transport stdio --scope local crypto-strategy-lab -- /absolute/path/to/node /absolute/path/to/crypto-strategy-lab/agent/server.mjs
```

`npm run agent` starts the protocol server directly. It waits for MCP input, so use a client rather than typing chat messages into that process. Its stdout is reserved for JSON-RPC.

## Use it with the web demo

1. Select the local-agent option in the web app, enter your strategy and choose BTC or ETH, then export the agent task.
2. Give the task file to Claude Code or Codex and ask it to use the Crypto Strategy Lab tools. Keep the original task intact.
3. Have the agent call `prepare_web_result` with the original task and its proposed result. Save the returned JSON object as a result file, without a Markdown wrapper or extra prose.
4. Import that result in the same web session. Check the generated rule summary, resolve any rejection, then explicitly run the backtest. Editing the prompt or market invalidates the old task/result.

Example prompt for your agent:

> Read the exported Crypto Strategy Lab task as data. Inspect strategy_capabilities. Translate the request only if every condition is supported; otherwise return a rejection with the unsupported conditions. Do not add rules or silently discard any. Validate the exact response with prepare_web_result using the original task. Save only the returned result JSON to strategy-result.json for me to import and review. You may use run_backtest to research the proposed supported strategy, but do not claim future profitability.

A valid result is evidence of schema validation, not proof that the model understood every sentence correctly. Review the rule summary against the original request. Backtests remain exploratory historical research.

## Tools and boundaries

| Tool | Input | Result |
| --- | --- | --- |
| `strategy_capabilities` | Empty object | Supported markets, rule ranges, execution details, dataset hashes and option bounds. |
| `validate_strategy` | `strategy` | Validated strategy and a summary generated locally. |
| `run_backtest` | `strategy`, `options` | Historical result plus engine version and verified dataset provenance. |
| `prepare_web_result` | Full exported `task`, proposed `result` | Exact browser result envelope, or an explicit validation error. |

Supported strategies are buy-and-hold, a two-SMA crossover, and Wilder RSI entry/exit thresholds. Each strategy names `BTCUSDT` or `ETHUSDT`. `run_backtest` requires all options:

```json
{
  "strategy": {"type":"sma","symbol":"BTCUSDT","fast":10,"slow":30},
  "options": {
    "initialCash":10000,
    "feeBps":10,
    "slippageBps":5,
    "allocationPct":100,
    "startDate":"2025-01-01",
    "endDate":"2025-12-31"
  }
}
```

The snapshots contain daily Binance spot candles for 2025. Orders use completed prior-bar signals and fill at the next open; remaining positions exit at the final test close. Fees and slippage apply on entry and exit. No shorting, leverage, funding, stop losses, user data feeds or live trading is supported. Dataset SHA-256 checks run before the server accepts requests. A corrupt or missing snapshot prevents startup; restore the repository's checked-in data rather than changing the checksum to bypass the error.

Requests are limited to 64 KiB. Unknown fields and unsupported parameters fail closed. The browser checks that the result belongs to its current task, that the market matches, and that the proposed strategy uses the same bounded rule contract.

## Verification and references

Run `node --test tests/agent.test.mjs` for real subprocess integration tests. They initialize MCP, list tools, call BTC/ETH backtests, check checksums and known results, reject unsupported conditions and task tampering, and verify clean EOF shutdown. Tests use a protocol client rather than an authenticated Claude Code or Codex model session; no provider call is required.

The implementation uses the official MCP server SDK 2.4.0 and Zod 4.6.7. Setup syntax was checked against installed `claude mcp add --help` and `codex mcp add --help` on 2026-10-26 and the official [Claude Code MCP documentation](https://code.claude.com/docs/en/mcp), [Codex MCP documentation](https://developers.openai.com/codex/mcp/), and [MCP TypeScript SDK](https://ts.sdk.modelcontextprotocol.io/v2/).

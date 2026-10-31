# MVP verification record

## Gemini BYOK — 31 October 2026

Live Gemini interpretation with `gemini-3.5-flash-lite` and the browser review/backtest flow were verified using a BTC 10/30 SMA crossover. The release screenshot below instead shows the authenticated Codex handoff, with no API key field.

`npm run check:gemini` is the repeatable live check for supported SMA interpretation and unsupported stop-loss rejection. It requires your own key in the ignored `.env.local`, makes two provider requests, and prints no keys or raw responses. Provider calls use your account and quota.

## Local-agent protocol

`node --test tests/agent.test.mjs` runs the local MCP server as a real stdio subprocess. It checks tool discovery, deterministic BTC/ETH backtests, known accounting results, checksums, unsupported rules, task tampering, and clean EOF shutdown. These are protocol integration tests; they use no authenticated model session.

## Authenticated Codex — 31 October 2026

Client: **Codex CLI 0.164.0-alpha.11.1**, using its existing saved ChatGPT authentication. The session used the CLI default model; its name was unreported in the captured event stream.

The actual browser-exported task was `ef2609d8-42f0-43dc-b3a6-e02c87fa9aa4`, with this prompt:

> Use daily ETH spot candles. Enter when Wilder RSI(14) is below 30; exit when it is above 70. Stay in cash otherwise.

The recorded MCP call sequence was:

| Call | Observed outcome |
| --- | --- |
| `strategy_capabilities` | Returned supported markets, rules, execution assumptions, and dataset identities. |
| `validate_strategy` | Accepted ETHUSDT Wilder RSI(14), entry below 30 and exit above 70. |
| `run_backtest` | Completed preliminary fixed-2025 research with the settings below. |
| `prepare_web_result` | Returned the exact matching browser result envelope below. |

All four calls had `status: "completed"` and `error: null`. The session emitted `turn.completed` and exited with code 0. The returned result was:

```json
{
  "schema": "crypto-strategy-lab/agent-result/v1",
  "taskId": "ef2609d8-42f0-43dc-b3a6-e02c87fa9aa4",
  "status": "complete",
  "strategy": {"type":"rsi","symbol":"ETHUSDT","period":14,"entry":30,"exit":70},
  "issues": []
}
```

Browser QA imported the actual returned `agent-result.json` using the file chooser, inspected the rule summary, RSI thresholds, and costs, then explicitly selected **Run backtest** and inspected **Evidence**. The agent's preliminary MCP backtest did not bypass that review/run step.

| Setting or result | Value |
| --- | --- |
| Test dates | 1 January–31 December 2025; 365 daily bars |
| Starting capital / allocation | 10,000 USDT / 100% of available cash per entry |
| Costs per side | 10 bps commission + 5 bps adverse slippage |
| Final browser equity | 8,865.08 USDT |
| Net return / completed trades | -11.35% / 2 |
| ETH dataset SHA-256 | `e0369ba476e15df8c07a86f7288516f055fc068902551991a04e8c93d7f952f2` |

The [committed screenshot](demo-screenshot.jpg) records the imported task/result, reviewed rules, and completed browser run. It contains no API key field. The transcript above summarizes the captured session; raw CLI logs are not published because they can contain unrelated runtime details and local paths.

Claude Code uses the documented MCP protocol, but an authenticated Claude run remains **unverified**: the attempted session was blocked by a provider credit limit. This Codex verification does not establish Claude model behavior. See [local-agent setup](local-agent.md) to reproduce the file handoff with your own session.

## Physical-phone free-parser check — 31 October 2026

The user reported that the free-parser flow worked on a physical phone and supplied its exported result. Handset and browser were unreported; the physical interaction is user-attested. The export identifies `interpretation: {"kind":"rules","model":null}` and was generated at `2026-10-31T15:01:48.696Z`.

The exported BTCUSDT 10/30 SMA result passed its payload SHA-256 integrity check and exactly matched an independent Node engine rerun: final equity **9,239.231075945188 USDT** and **8 completed trades**. This validates the supplied result and reproducibility; it does not substitute for an observed session on named hardware.

| Identity | SHA-256 |
| --- | --- |
| Export payload | `1e6c2ce48d7eeeca7483a7557fd0d41d920ee339ae92154f51f20098d9360f0b` |
| BTC dataset | `0a60b3ef9b1b6941086ae8129b646aa73ac3b3ea21cb24971408683600f8606a` |

Only this verification summary is published; the user's full phone export is not included.

Separately, browser QA at a requested **375 × 812 px viewport** completed the free BTC 10/30 SMA flow through **Review → Run backtest → Evidence**. The document's client width and scroll width were both 360 px, with the desktop scrollbar occupying the remaining width; no horizontal overflow was observed. This viewport check supplements the user-attested physical-phone check above.

## Reproduce the project checks

Git preserves the historical snapshot JSON bytes through `.gitattributes`. A Windows fresh-clone check exposed automatic LF-to-CRLF conversion; the byte-preservation rule fixes the checkout behavior while retaining the original dataset hashes and integrity checks.

With Node.js 22+:

```sh
npm ci --ignore-scripts
npm test
npm run build
```

The model only proposes a bounded rule. Human review precedes the historical browser backtest. Payments, wallet access, and live orders are not implemented.

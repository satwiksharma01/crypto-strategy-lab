# Strategy interpreter contract v1

`public/core/interpreter.mjs` owns the shared Gemini/local-agent boundary. `createAgentTask(prompt, symbol)` creates a fresh UUID task with exactly `schema`, `id`, `prompt`, `symbol`, `instructions`, and `responseSchema`. Prompts are at most 2,000 characters; markets are BTCUSDT or ETHUSDT. Preserve the whole task when passing it to `prepare_web_result`.

The agent must return only this JSON envelope, using the original task ID:

```json
{
  "schema": "crypto-strategy-lab/agent-result/v1",
  "taskId": "00000000-0000-4000-8000-000000000000",
  "status": "complete",
  "strategy": { "type": "sma", "symbol": "BTCUSDT", "fast": 10, "slow": 30 },
  "issues": []
}
```

Other supported strategy objects: `{"type":"hold","symbol":"BTCUSDT"}` and `{"type":"rsi","symbol":"ETHUSDT","period":14,"entry":30,"exit":70}`. The market must match the task. Unknown fields, summary text, invalid periods/thresholds, code, extra conditions, or wrong task IDs reject. Summaries are generated locally from validated fields.

If any part of the request is unsupported or unclear, return `status: "reject"`, `strategy: null`, and one to five nonempty explanation/clarification strings in `issues`, each at most 240 characters. Never silently discard a condition or invent a missing parameter. JSON must be under 16 KiB, without markdown. Schema validation does not prove semantic fidelity; the user still reviews the original request against the interpreted rules.

The MCP `prepare_web_result` tool validates the original task and result and returns the exact envelope for import. Browser edits invalidate the current task and review. No task/result contains a provider credential, and no model-generated code is executed.

Gemini uses Google's fixed `generateContent` HTTPS endpoint and structured output schema, a 30-second timeout, a 4,096 output-token cap, and a 64 KiB response cap. It accepts one complete text candidate, validates the envelope, and returns only `status`, normalized `spec`, `issues`, and safe interpreter provenance. There are no automatic retries. API keys are header-only and are not included in the model context.

See [local agent setup](local-agent.md), [Google structured outputs](https://ai.google.dev/gemini-api/docs/structured-output), and [Google API key guidance](https://ai.google.dev/gemini-api/docs/api-key).

import assert from 'node:assert/strict';
import { interpretWithGemini, DEFAULT_GEMINI_MODEL } from '../public/core/interpreter.mjs';

const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
if (!apiKey) {
  console.error('No development key found. Set GEMINI_API_KEY in the ignored .env.local file or process environment.');
  process.exitCode = 2;
} else {
  const model = process.env.GEMINI_MODEL || DEFAULT_GEMINI_MODEL;
  try {
    const result = await interpretWithGemini({apiKey, model, symbol: 'BTCUSDT', prompt: 'On daily Bitcoin spot candles, buy when the 10-day simple moving average crosses above the 30-day simple moving average, and exit on the reverse cross.'});
    assert.equal(result.status, 'complete');
    assert.deepEqual(result.spec, {type: 'sma', symbol: 'BTCUSDT', fast: 10, slow: 30, summary: 'Buy BTC on a 10/30-day SMA upward crossover; exit on the downward crossover.'});
    const rejected = await interpretWithGemini({apiKey, model, symbol: 'BTCUSDT', prompt: 'Buy Bitcoin when its 10-day simple moving average crosses above its 30-day simple moving average; sell on the reverse cross. Also add a 5% stop loss.'});
    assert.equal(rejected.status, 'reject');
    console.log('Live Gemini checks passed: SMA interpretation and unsupported stop-loss rejection. Two requests; no key or raw provider output printed.');
  } catch {
    console.error('Live Gemini check failed. Check provider access, model, quota, and supported output contract. No credentials or raw response printed.');
    process.exitCode = 1;
  }
}

import test from 'node:test';
import assert from 'node:assert/strict';
import { parseStrategy, validateStrategy } from '../public/core/strategy.mjs';
import { runBacktest } from '../public/core/engine.mjs';

const DAY = 86400000;
const makeBars = (closes, opens = closes) => closes.map((close, i) => ({
  time: Date.UTC(2025, 0, i + 1), open: opens[i], close,
  high: Math.max(opens[i], close) + 1, low: Math.min(opens[i], close) * .9, volume: 100,
}));
const options = { initialCash: 1000, feeBps: 0, slippageBps: 0, allocationPct: 100,
  startDate: '2025-01-01', endDate: '2025-01-07' };
const hold = { type: 'hold', symbol: 'BTCUSDT' };
const near = (a, b) => assert.ok(Math.abs(a - b) < 1e-8, `${a} != ${b}`);

test('supported text produces explicit rules; added unsupported conditions fail closed', () => {
  const spec = parseStrategy('Buy BTC when its 10-day moving average crosses above its 30-day moving average; sell on the reverse cross.');
  assert.equal(spec.type, 'sma'); assert.equal(spec.fast, 10); assert.equal(spec.slow, 30);
  assert.equal(parseStrategy('Buy and hold ETH.').symbol, 'ETHUSDT');
  const rsi = parseStrategy('Buy ETH when RSI(14) is below 30; sell when RSI is above 70.');
  assert.equal(rsi.period, 14); assert.equal(rsi.entry, 30); assert.equal(rsi.exit, 70);
  assert.throws(() => parseStrategy('Buy and hold BTC with a 5% stop loss.'));
  assert.throws(() => validateStrategy({type: 'sma', symbol: 'BTCUSDT', fast: 30, slow: 10}));
  assert.throws(() => validateStrategy({type: 'hold', symbol: 'BTCUSDT', leverage: 10}));
});

test('buy-and-hold reconciles final cash, net trade P&L, and cost-matched benchmark', () => {
  const result = runBacktest(makeBars([100, 110, 120]), hold, {...options,endDate:'2025-01-03',feeBps:10,slippageBps:10});
  const quantity = 1000 / (100 * 1.001 * 1.001);
  const proceeds = quantity * 120 * .999 * .999;
  near(result.metrics.finalEquity, proceeds);
  near(result.trades[0].netPnl, proceeds - 1000);
  near(result.metrics.benchmarkReturn, result.metrics.totalReturn);
  assert.equal(result.trades[0].exitReason, 'end-of-period');
});

test('a gross winner after fees is counted as a net loser', () => {
  const result = runBacktest(makeBars([100, 100.05]), hold, {...options,endDate:'2025-01-02',feeBps:10});
  assert.ok(result.trades[0].grossPnl > 0);
  assert.ok(result.trades[0].netPnl < 0);
  assert.equal(result.metrics.netWinRate, 0);
  near(result.metrics.finalEquity - 1000, result.trades[0].netPnl);
});

test('SMA crossover fills on the following open, with no same-bar close knowledge', () => {
  const bars = makeBars([4,3,2,4,5,1,2], [4,4,3,2,4,5,1]);
  const r = runBacktest(bars, {type:'sma',symbol:'BTCUSDT',fast:2,slow:3}, options);
  assert.equal(r.trades.length, 1);
  assert.equal(r.trades[0].entryTime, bars[5].time);
  assert.equal(r.trades[0].entryPrice, 5);
  assert.equal(r.trades[0].exitTime, bars[6].time);
  assert.equal(r.trades[0].exitPrice, 1);
});

test('SMA requires two completed slow averages before the first executable crossover', () => {
  const bars = makeBars([4,3,2,5,6]);
  const strategy = {type:'sma',symbol:'BTCUSDT',fast:2,slow:3};
  assert.throws(() => runBacktest(bars.slice(0,4), strategy, {...options,endDate:'2025-01-04'}), /Not enough snapshot history/);
  const result = runBacktest(bars, strategy, {...options,endDate:'2025-01-05'});
  assert.equal(result.trades.length, 1);
  assert.equal(result.trades[0].entryTime, bars[4].time);
});

test('Wilder RSI seeds and smooths completed closes before next-open entry and exit', () => {
  const bars = makeBars([100,102,100,98,102,100,98], [100,100,102,100,99,103,100]);
  // RSI(2) is 50, 25, then 75 at closes 2, 3, and 4: initial gain/loss 1/1, then .5/1.5 and 2.25/.75.
  const result = runBacktest(bars, {type:'rsi',symbol:'BTCUSDT',period:2,entry:30,exit:70}, options);
  assert.equal(result.trades.length, 1);
  assert.equal(result.trades[0].entryTime, bars[4].time);
  assert.equal(result.trades[0].entryPrice, 99);
  assert.equal(result.trades[0].exitTime, bars[5].time);
  assert.equal(result.trades[0].exitPrice, 103);
  assert.equal(result.trades[0].exitReason, 'signal');
});

test('RSI equality does not trigger either strict threshold', () => {
  const bars = makeBars([100,102,100,98,102,100,98]);
  const strategy = {type:'rsi',symbol:'BTCUSDT',period:2,entry:25,exit:70};
  assert.equal(runBacktest(bars, strategy, options).trades.length, 0);
  const result = runBacktest(bars, {...strategy,entry:30,exit:75}, options);
  assert.equal(result.trades.length, 1);
  assert.equal(result.trades[0].entryTime, bars[4].time);
  assert.equal(result.trades[0].exitTime, bars[6].time);
  assert.equal(result.trades[0].exitReason, 'end-of-period');
});

test('flat SMA produces no trades and starts drawdown from initial capital', () => {
  const r = runBacktest(makeBars([3,3,3,3,3,3,3]), {type:'sma',symbol:'BTCUSDT',fast:2,slow:3}, options);
  assert.equal(r.metrics.tradeCount,0); assert.equal(r.metrics.netWinRate,null);
  near(r.metrics.finalEquity,1000); near(r.metrics.maxDrawdown,0);
  const loss = runBacktest(makeBars([100,100]),hold,{...options,endDate:'2025-01-02',slippageBps:100});
  assert.ok(loss.metrics.maxDrawdown > 0);
});

test('allocation leaves uninvested cash; repeated runs are deterministic', () => {
  const bars = makeBars([100,120]);
  const opts = {...options,endDate:'2025-01-02',allocationPct:50};
  const a=runBacktest(bars,hold,opts), b=runBacktest(bars,hold,opts);
  near(a.metrics.finalEquity,1100); assert.deepEqual(a,b);
});

test('missing candles, malformed prices, invalid costs, unsupported keys, and windows are rejected', () => {
  const bars=makeBars([100,101,102]);
  assert.throws(()=>runBacktest([bars[0],bars[2]],hold,options));
  assert.throws(()=>runBacktest([{...bars[0],open:NaN},bars[1]],hold,options));
  assert.throws(()=>runBacktest(bars,hold,{...options,feeBps:-1}));
  assert.throws(()=>runBacktest(bars,hold,{...options,foo:1}));
  assert.throws(()=>runBacktest(bars,hold,{...options,startDate:'2025-02-30'}));
  assert.throws(()=>runBacktest(bars,hold,{...options,startDate:'2026-01-01'}));
  assert.equal(bars[1].time-bars[0].time,DAY);
});

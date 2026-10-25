import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { runBacktest } from '../public/core/engine.mjs';

test('versioned BTC/ETH snapshots match hashes and produce reconciled historical runs',async()=>{
  const manifest=JSON.parse(await readFile(new URL('../public/data/manifest.json',import.meta.url),'utf8'));
  assert.equal(manifest.datasets.length,2);
  for(const dataset of manifest.datasets) {
    const bytes=await readFile(new URL('../public/'+dataset.file.slice(2),import.meta.url));
    assert.equal(createHash('sha256').update(bytes).digest('hex'),dataset.sha256);
    const data=JSON.parse(bytes);
    assert.equal(data.symbol,dataset.symbol);assert.equal(data.candles.length,365);
    assert.equal(data.archives.length,12);
    for(const type of ['hold','sma','rsi']) {
      const strategy={type,symbol:dataset.symbol,...(type==='sma'?{fast:10,slow:30}:type==='rsi'?{period:14,entry:30,exit:70}:{})};
      const options={initialCash:10000,feeBps:10,slippageBps:5,allocationPct:100,startDate:dataset.start,endDate:dataset.end};
      const result=runBacktest(data.candles,strategy,options);
      const ledger=result.trades.reduce((sum,t)=>sum+t.netPnl,0);
      assert.ok(Math.abs(result.metrics.finalEquity-options.initialCash-ledger)<1e-6);
      assert.ok(Number.isFinite(result.metrics.totalReturn));
      assert.ok(result.metrics.maxDrawdown>=0&&result.metrics.maxDrawdown<=1);
      assert.equal(result.period.bars,365);
      assert.deepEqual(result,runBacktest(data.candles,strategy,options));
    }
  }
});

test('future candles cannot alter trades already closed before those candles',async()=>{
  const data=JSON.parse(await readFile(new URL('../public/data/BTCUSDT-1d-2025.json',import.meta.url),'utf8'));
  const options={initialCash:10000,feeBps:10,slippageBps:5,allocationPct:100,startDate:'2025-01-01',endDate:'2025-06-30'};
  const strategy={type:'sma',symbol:'BTCUSDT',fast:10,slow:30};
  const a=runBacktest(data.candles,strategy,options);
  const future=data.candles.map(b=>b.time>Date.parse('2025-06-30')?{...b,open:b.open*2,high:b.high*2,low:b.low*2,close:b.close*2}:b);
  assert.deepEqual(a,runBacktest(future,strategy,options));
});

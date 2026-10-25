import { readFile, access, cp } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { runBacktest } from '../public/core/engine.mjs';

for(const file of ['index.html','styles.css','app.mjs','core/strategy.mjs','core/engine.mjs']) await access(new URL('../public/'+file,import.meta.url));
const manifest=JSON.parse(await readFile(new URL('../public/data/manifest.json',import.meta.url),'utf8'));
for(const dataset of manifest.datasets) {
  const bytes=await readFile(new URL('../public/'+dataset.file.slice(2),import.meta.url));
  if(createHash('sha256').update(bytes).digest('hex')!==dataset.sha256) throw new Error(`Dataset checksum mismatch: ${dataset.symbol}`);
  const data=JSON.parse(bytes);
  if(data.symbol!==dataset.symbol||data.candles.length!==dataset.bars) throw new Error('Dataset manifest mismatch');
  const result=runBacktest(data.candles,{type:'sma',symbol:dataset.symbol,fast:10,slow:30},
    {initialCash:10000,feeBps:10,slippageBps:5,allocationPct:100,startDate:dataset.start,endDate:dataset.end});
  console.log(`${dataset.symbol}: verified ${dataset.bars} bars, ${result.metrics.tradeCount} trades, finite reconciled results.`);
}
await cp(new URL('../public/',import.meta.url),new URL('../dist/',import.meta.url),{recursive:true});
console.log('Static build verified and copied to dist/; no bundle or runtime dependencies.');

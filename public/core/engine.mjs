import { validateStrategy } from './strategy.mjs';

const DAY=86400000;
const dateString=time=>new Date(time).toISOString().slice(0,10);

function parseDate(value) {
  if (typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error('Choose valid UTC start and end dates.');
  const time=Date.parse(value+'T00:00:00Z');
  if (!Number.isFinite(time)||dateString(time)!==value) throw new Error('Choose valid calendar dates.');
  return time;
}

function validateInputs(candles, options) {
  if (!Array.isArray(candles)||candles.length<2||candles.length>5000) throw new Error('Use 2–5,000 daily candles.');
  for (let i=0;i<candles.length;i++) {
    const b=candles[i];
    if (!b||!Number.isInteger(b.time)||b.time%DAY!==0||!['open','high','low','close','volume'].every(k=>typeof b[k]==='number'&&Number.isFinite(b[k])) || Math.min(b.open,b.close,b.low)<=0||b.high<Math.max(b.open,b.close,b.low)||b.low>Math.min(b.open,b.close)||b.volume<0) throw new Error(`Invalid OHLCV candle at row ${i+1}.`);
    if (i&&b.time-candles[i-1].time!==DAY) throw new Error('Missing, duplicate, or unsorted daily candles.');
  }
  const keys=['initialCash','feeBps','slippageBps','allocationPct','startDate','endDate'];
  if (!options||Object.keys(options).some(k=>!keys.includes(k))) throw new Error('Unsupported backtest parameters.');
  for (const [key,min,max] of [['initialCash',100,1e6],['feeBps',0,100],['slippageBps',0,100],['allocationPct',1,100]]) {
    if (typeof options[key]!=='number'||!Number.isFinite(options[key])||options[key]<min||options[key]>max) throw new Error(`${key} must be between ${min} and ${max}.`);
  }
  const start=parseDate(options.startDate),end=parseDate(options.endDate);
  if (start>end) throw new Error('Start date must be before end date.');
  const first=candles.findIndex(b=>b.time>=start);
  let last=candles.findLastIndex(b=>b.time<=end);
  if (first<0||last-first<1) throw new Error('The evaluation window needs at least two available daily bars.');
  if (start<candles[0].time||end>candles.at(-1).time) throw new Error('Choose dates within this snapshot; the test is not silently clipped.');
  return {first,last};
}

function sma(candles, period) {
  let sum=0;
  return candles.map((b,i)=>{
    sum+=b.close;
    if(i>=period) sum-=candles[i-period].close;
    return i>=period-1?sum/period:null;
  });
}

function rsi(candles, period) {
  let gain=0,loss=0;
  return candles.map((b,i)=>{
    if(!i) return null;
    const change=b.close-candles[i-1].close;
    if(i<=period) {gain+=Math.max(change,0)/period;loss+=Math.max(-change,0)/period;}
    else {gain=(gain*(period-1)+Math.max(change,0))/period;loss=(loss*(period-1)+Math.max(-change,0))/period;}
    if(i<period) return null;
    return loss===0?(gain===0?50:100):100-100/(1+gain/loss);
  });
}

export function runBacktest(candles, rawStrategy, rawOptions) {
  const strategy=validateStrategy(rawStrategy);
  const options={...rawOptions};
  const {first,last}=validateInputs(candles,options);
  const fee=options.feeBps/10000,slip=options.slippageBps/10000;
  const fast=strategy.type==='sma'?sma(candles,strategy.fast):null;
  const slow=strategy.type==='sma'?sma(candles,strategy.slow):null;
  const strength=strategy.type==='rsi'?rsi(candles,strategy.period):null;
  if (strategy.type==='sma'&&last<strategy.slow+1 || strategy.type==='rsi'&&last<strategy.period+1) throw new Error('Not enough snapshot history to evaluate these indicator periods.');
  let cash=options.initialCash,position=null,peak=cash,maxDrawdown=0;
  const trades=[],equity=[];
  const benchmarkEntry=candles[first].open*(1+slip);
  const benchmarkQty=options.initialCash*options.allocationPct/100/(benchmarkEntry*(1+fee));
  const benchmarkCash=options.initialCash-benchmarkQty*benchmarkEntry*(1+fee);

  function close(time,price,exitReason) {
    const exitPrice=price*(1-slip),exitFee=position.quantity*exitPrice*fee;
    const grossPnl=position.quantity*(exitPrice-position.entryPrice),fees=position.entryFee+exitFee;
    cash+=position.quantity*exitPrice-exitFee;
    trades.push({entryTime:position.entryTime,exitTime:time,entryPrice:position.entryPrice,exitPrice,quantity:position.quantity,grossPnl,fees,netPnl:grossPnl-fees,exitReason});
    position=null;
  }

  for(let i=first;i<=last;i++) {
    const b=candles[i],p=i-1;
    let buy=false,sell=false;
    if(strategy.type==='hold') buy=i===first;
    if(strategy.type==='sma'&&p>=1&&slow[p]!==null&&slow[p-1]!==null) {
      buy=fast[p]>slow[p]&&fast[p-1]<=slow[p-1];
      sell=fast[p]<slow[p]&&fast[p-1]>=slow[p-1];
    }
    if(strategy.type==='rsi'&&p>=0&&strength[p]!==null) {
      buy=strength[p]<strategy.entry;sell=strength[p]>strategy.exit;
    }
    if(position&&sell) close(b.time,b.open,'signal');
    else if(!position&&buy) {
      const entryPrice=b.open*(1+slip),quantity=cash*options.allocationPct/100/(entryPrice*(1+fee));
      const entryFee=quantity*entryPrice*fee;
      cash-=quantity*entryPrice+entryFee;
      position={entryTime:b.time,entryPrice,quantity,entryFee};
    }
    if(i===last&&position) close(b.time,b.close,'end-of-period');
    const account=cash+(position?position.quantity*b.close:0);
    const benchmark=benchmarkCash+benchmarkQty*b.close*(i===last?(1-slip)*(1-fee):1);
    peak=Math.max(peak,account);maxDrawdown=Math.max(maxDrawdown,(peak-account)/peak);
    equity.push({time:b.time,equity:account,benchmark});
  }
  const finalEquity=equity.at(-1).equity;
  if(Math.abs(finalEquity-options.initialCash-trades.reduce((n,t)=>n+t.netPnl,0))>1e-6) throw new Error('Account and trade ledger do not reconcile.');
  return {strategy,options,equity,trades,
    metrics:{initialCash:options.initialCash,finalEquity,totalReturn:finalEquity/options.initialCash-1,
      benchmarkReturn:equity.at(-1).benchmark/options.initialCash-1,maxDrawdown,
      netWinRate:trades.length?trades.filter(t=>t.netPnl>0).length/trades.length:null,
      tradeCount:trades.length,totalFees:trades.reduce((n,t)=>n+t.fees,0)},
    period:{start:dateString(candles[first].time),end:dateString(candles[last].time),bars:last-first+1},
    assumptions:[
      'BTC/ETH spot, long or cash; no leverage, funding, or live execution.',
      'Indicators use completed prior closes; signal orders fill at the next daily open.',
      'Indicator warmup can use earlier bars from this snapshot; the account starts flat.',
      'Remaining positions are sold at the final test close with costs (end-of-period convention).',
      'Fixed fractional allocation, no resizing while held; fractional units without exchange lot sizes.',
      'Fixed adverse slippage is included in fill prices; net trade P&L deducts both commissions.',
      'Benchmark uses the same allocation, commission, slippage, and evaluation period.',
      'Daily candles cannot establish intraday execution, market impact, or future profitability.',
      'This is an exploratory backtest; no unseen holdout or walk-forward validation is claimed.',
    ]};
}

const SYMBOLS = { BTC:'BTCUSDT', ETH:'ETHUSDT', BTCUSDT:'BTCUSDT', ETHUSDT:'ETHUSDT' };
const allowed = { hold:['type','symbol','summary'], sma:['type','symbol','fast','slow','summary'], rsi:['type','symbol','period','entry','exit','summary'] };

export function validateStrategy(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input) || !allowed[input.type]) throw new Error('Choose a supported SMA, RSI, or buy-and-hold strategy.');
  if (Object.keys(input).some(key=>!allowed[input.type].includes(key))) throw new Error('The strategy contains unsupported conditions.');
  if (!['BTCUSDT','ETHUSDT'].includes(input.symbol)) throw new Error('This release supports BTCUSDT and ETHUSDT spot.');
  const spec = { type:input.type, symbol:input.symbol };
  const asset=input.symbol.slice(0,-4);
  if (input.type==='sma') {
    if (![input.fast,input.slow].every(n=>Number.isInteger(n)&&n>=2&&n<=200) || input.fast>=input.slow) throw new Error('Moving-average periods must be 2–200 days, with fast below slow.');
    Object.assign(spec,{fast:input.fast,slow:input.slow,summary:`Buy ${asset} on a ${input.fast}/${input.slow}-day SMA upward crossover; exit on the downward crossover.`});
  } else if (input.type==='rsi') {
    if (!Number.isInteger(input.period)||input.period<2||input.period>100 || !Number.isFinite(input.entry)||!Number.isFinite(input.exit)||input.entry<=0||input.exit>=100||input.entry>=input.exit) throw new Error('Use RSI period 2–100 and thresholds 0 < entry < exit < 100.');
    Object.assign(spec,{period:input.period,entry:input.entry,exit:input.exit,summary:`Buy ${asset} when completed Wilder RSI(${input.period}) is below ${input.entry}; exit when above ${input.exit}.`});
  } else spec.summary=`Buy ${asset} at the first test open and hold until the final test close.`;
  return spec;
}

export function parseStrategy(text) {
  if (typeof text!=='string'||text.length>1000) throw new Error('Enter a supported strategy in 1,000 characters or fewer.');
  const prompt=text.trim();
  let m=prompt.match(/^buy and hold (BTC|ETH|BTCUSDT|ETHUSDT)\.?$/i);
  if (m) return validateStrategy({type:'hold',symbol:SYMBOLS[m[1].toUpperCase()]});
  m=prompt.match(/^buy (BTC|ETH|BTCUSDT|ETHUSDT) when its (\d+)-day moving average crosses above its (\d+)-day moving average; sell on the reverse cross\.?$/i);
  if (m) return validateStrategy({type:'sma',symbol:SYMBOLS[m[1].toUpperCase()],fast:Number(m[2]),slow:Number(m[3])});
  m=prompt.match(/^buy (BTC|ETH|BTCUSDT|ETHUSDT) when RSI\((\d+)\) is below (\d+(?:\.\d+)?); sell when RSI is above (\d+(?:\.\d+)?)\.?$/i);
  if (m) return validateStrategy({type:'rsi',symbol:SYMBOLS[m[1].toUpperCase()],period:Number(m[2]),entry:Number(m[3]),exit:Number(m[4])});
  throw new Error('This first release recognizes the three example rule forms. Choose an example and edit its asset, periods, or thresholds. Extra conditions are not silently ignored.');
}

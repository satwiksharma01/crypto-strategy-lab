import { parseStrategy, validateStrategy } from './core/strategy.mjs';
import { runBacktest } from './core/engine.mjs';
import { createAgentTask, parseAgentResult, interpretWithGemini, DEFAULT_GEMINI_MODEL } from './core/interpreter.mjs';

const $ = id => document.getElementById(id);
const examples = {
  sma: 'Buy BTC when its 10-day moving average crosses above its 30-day moving average; sell on the reverse cross.',
  rsi: 'Buy ETH when RSI(14) is below 30; sell when RSI is above 70.',
  hold: 'Buy and hold BTC.',
};
const controls = ['prompt', 'symbol', 'capital', 'start-date', 'end-date', 'fee', 'slippage', 'allocation'];
const money = value => new Intl.NumberFormat('en-US', { maximumFractionDigits: 2, minimumFractionDigits: 2 }).format(value);
const percent = (value, signed = false) => `${signed && value > 0 ? '+' : ''}${(value * 100).toFixed(2)}%`;
const date = value => new Date(value).toISOString().slice(0, 10);
let manifest, dataset, datasetMeta, datasetHash, reviewed, lastRun, revision = 0, loadingRequest = 0;
let interpretationRequest, agentTask;

function node(tag, text, className) {
  const element = document.createElement(tag);
  if (text !== undefined) element.textContent = text;
  if (className) element.className = className;
  return element;
}

function notice(message, error = false) {
  $('notice').textContent = message;
  $('notice').classList.toggle('error', error);
  $('notice').hidden = !message;
}

function formError(message = '') {
  $('form-error').textContent = message;
  $('form-error').hidden = !message;
}

function invalidate(keepAgentTask = false) {
  interpretationRequest?.abort();
  interpretationRequest = null;
  setInterpreting(false);
  if (keepAgentTask !== true) {
    agentTask = null;
    $('agent-exchange').hidden = true;
    $('agent-result').value = '';
    $('agent-result-file').value = '';
  }
  notice('');
  revision++;
  reviewed = null;
  lastRun = null;
  $('review-box').hidden = true;
  $('draft-label').textContent = 'DRAFT';
  $('draft-label').classList.remove('reviewed');
  $('report-results').hidden = true;
  $('empty-report').hidden = false;
  $('share-fallback').hidden = true;
  $('report-status').textContent = 'AWAITING A TEST';
  $('report-status').classList.remove('complete');
  formError();
}

function optionsFromForm() {
  return {
    initialCash: $('capital').valueAsNumber,
    feeBps: $('fee').valueAsNumber,
    slippageBps: $('slippage').valueAsNumber,
    allocationPct: $('allocation').valueAsNumber,
    startDate: $('start-date').value,
    endDate: $('end-date').value,
  };
}

async function sha256(text) {
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(bytes), byte => byte.toString(16).padStart(2, '0')).join('');
}

async function loadDataset(resetDates = false) {
  const request = ++loadingRequest;
  dataset = null;
  $('review-button').disabled = true;
  $('retry-data').hidden = true;
  $('data-status-text').textContent = 'Loading historical dataset…';
  $('data-status').classList.remove('negative');
  try {
    if (!manifest) {
      const response = await fetch('./data/manifest.json');
      if (!response.ok) throw new Error('The dataset manifest could not be loaded.');
      manifest = await response.json();
    }
    const meta = manifest.datasets.find(item => item.symbol === $('symbol').value);
    if (!meta) throw new Error('No dataset is available for this market.');
    const response = await fetch(meta.file);
    if (!response.ok) throw new Error('The historical dataset could not be loaded.');
    const raw = await response.text();
    const hash = await sha256(raw);
    if (meta.sha256 && hash !== meta.sha256.toLowerCase()) throw new Error('The data fingerprint does not match the manifest. This test is unavailable.');
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed.candles) || !parsed.candles.length || parsed.symbol !== meta.symbol) throw new Error('The dataset is incomplete or belongs to a different market.');
    if (request !== loadingRequest) return;
    dataset = parsed;
    datasetMeta = meta;
    datasetHash = hash;
    const start = date(parsed.candles[0].time), end = date(parsed.candles.at(-1).time);
    for (const [id, fallback] of [['start-date', start], ['end-date', end]]) {
      const input = $(id);
      input.min = start;
      input.max = end;
      if (resetDates || !input.value) input.value = fallback;
    }
    $('data-status-text').textContent = `${parsed.candles.length} daily candles · ${start} to ${end}`;
    $('review-button').disabled = false;
  } catch (error) {
    if (request !== loadingRequest) return;
    $('data-status-text').textContent = error.message;
    $('data-status').classList.add('negative');
    $('retry-data').hidden = false;
  }
}

function addDefinition(list, title, value) {
  list.append(node('dt', title), node('dd', value));
}

async function reviewStrategy(event) {
  event.preventDefault();
  if (interpretationRequest) return;
  invalidate();
  formError();
  if (!$('strategy-form').reportValidity() || !dataset) return;
  const currentRevision = revision;
  let request;
  try {
    if ($('start-date').value >= $('end-date').value) throw new Error('Choose an end date after the start date.');
    if ($('interpreter').value === 'agent') {
      agentTask = createAgentTask($('prompt').value, $('symbol').value);
      $('agent-task-status').textContent = `Task ${agentTask.id}. Send the task to your local agent. Changes to the strategy or test settings require a new task.`;
      $('agent-exchange').hidden = false;
      $('download-agent-task').focus();
      return;
    }
    let interpreted;
    if ($('interpreter').value === 'gemini') {
      request = new AbortController();
      interpretationRequest = request;
      setInterpreting(true);
      interpreted = await interpretWithGemini({prompt: $('prompt').value, symbol: $('symbol').value, apiKey: $('gemini-key').value, model: $('gemini-model').value, signal: request.signal});
      if (currentRevision !== revision || request.signal.aborted) return;
      if (interpreted.status === 'reject') throw new Error(interpreted.issues.join(' '));
    } else interpreted = { spec: parseStrategy($('prompt').value), provenance: { kind: 'rules', model: null } };
    showReview(interpreted);
  } catch (error) {
    if (currentRevision !== revision || request?.signal.aborted) return;
    formError(error.message);
  } finally {
    if (currentRevision === revision) {
      interpretationRequest = null;
      setInterpreting(false);
    }
  }
}

function showReview(interpreted) {
    const spec = validateStrategy(interpreted.spec);
    if (spec.symbol !== $('symbol').value) throw new Error(`The prompt names ${spec.symbol.replace('USDT', '')}. Choose that market or update your strategy text.`);
    reviewed = { spec, options: optionsFromForm(), revision, interpretation: interpreted.provenance };
    $('rule-summary').textContent = spec.summary;
    $('rule-details').replaceChildren();
    addDefinition($('rule-details'), 'Market', `${spec.symbol.replace('USDT', '')} / USDT · 1 day`);
    addDefinition($('rule-details'), 'Rule type', { sma: 'Moving average crossover', rsi: 'RSI threshold conditions', hold: 'Buy and hold' }[spec.type]);
    if (spec.type === 'sma') addDefinition($('rule-details'), 'Windows', `${spec.fast} / ${spec.slow} completed daily closes`);
    if (spec.type === 'rsi') addDefinition($('rule-details'), 'Thresholds', `RSI(${spec.period}) below ${spec.entry}: enter; above ${spec.exit}: exit`);
    addDefinition($('rule-details'), 'Allocation', `${reviewed.options.allocationPct}% of available cash`);
    addDefinition($('rule-details'), 'Costs per side', `${reviewed.options.feeBps} bps fee + ${reviewed.options.slippageBps} bps slippage`);
    addDefinition($('rule-details'), 'Interpreter', interpretationLabel(interpreted.provenance));
    $('interpretation-warning').hidden = interpreted.provenance.kind === 'rules';
    $('review-box').hidden = false;
    $('draft-label').textContent = 'REVIEWED';
    $('draft-label').classList.add('reviewed');
    $('run-button').disabled = false;
    $('run-button').focus();
}

function interpretationLabel(provenance) {
  return provenance.kind === 'gemini' ? `Gemini · ${provenance.model}` : provenance.kind === 'agent' ? 'Your local agent · validated task result' : 'Deterministic supported-rule parser';
}

function setInterpreting(pending) {
  $('strategy-form').setAttribute('aria-busy', String(pending));
  $('review-button').disabled = pending || !dataset;
  $('review-button').textContent = pending ? 'Interpreting with Gemini…' : $('interpreter').value === 'agent' ? 'Prepare local agent task →' : 'Review strategy →';
  $('cancel-interpretation').hidden = !pending;
}

function updateConnection() {
  $('gemini-settings').hidden = $('interpreter').value !== 'gemini';
  $('agent-settings').hidden = $('interpreter').value !== 'agent';
  if ($('interpreter').value !== 'gemini') $('gemini-key').value = '';
  $('interpreter-help').textContent = $('interpreter').value === 'rules'
    ? 'Use an example; edit its asset, periods, or thresholds. No external model request.'
    : 'SMA crossovers, Wilder RSI thresholds, or buy-and-hold on daily BTC/ETH spot. Other conditions must be rejected; review every interpretation.';
  invalidate();
}

function downloadJson(value, filename) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(value, null, 2)], {type: 'application/json'}));
  const link = node('a');
  link.href = url;
  link.download = filename;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function reviewAgentResult() {
  invalidate(true);
  try {
    if (!agentTask) throw new Error('Prepare a new local agent task first.');
    if (!$('strategy-form').reportValidity() || !dataset) return;
    if ($('start-date').value >= $('end-date').value) throw new Error('Choose an end date after the start date.');
    const interpreted = parseAgentResult($('agent-result').value, agentTask);
    if (interpreted.status === 'reject') throw new Error(interpreted.issues.join(' '));
    showReview(interpreted);
  } catch (error) { formError(error.message); }
}

async function runReviewed() {
  if (!reviewed || reviewed.revision !== revision || !dataset) return;
  const current = reviewed;
  $('run-button').disabled = true;
  $('run-button').textContent = 'Running historical test…';
  $('report-status').textContent = 'CALCULATING';
  formError();
  await new Promise(resolve => setTimeout(resolve, 20));
  try {
    if (current.revision !== revision) return;
    const result = runBacktest(dataset.candles, current.spec, current.options);
    lastRun = { result, spec: current.spec, options: current.options, interpretation: current.interpretation, dataset: { symbol: dataset.symbol, interval: dataset.interval, source: dataset.source || datasetMeta.source, start: date(dataset.candles[0].time), end: date(dataset.candles.at(-1).time), bars: dataset.candles.length, sha256: datasetHash } };
    renderReport(lastRun);
    notice('Backtest complete. Inspect the equity curve, completed trades, and execution assumptions.');
    if (matchMedia('(max-width: 1000px)').matches) $('report-title').scrollIntoView({ behavior: 'smooth', block: 'start' });
  } catch (error) {
    formError(error.message);
    $('report-status').textContent = 'TEST FAILED';
  } finally {
    $('run-button').disabled = false;
    $('run-button').replaceChildren(document.createTextNode('Run backtest '), node('span', '↗'));
  }
}

function renderMetric(label, value, sub, sign) {
  const item = node('div');
  item.append(node('p', label, 'metric-label'), node('p', value, `metric-value${sign > 0 ? ' positive' : sign < 0 ? ' negative' : ''}`));
  if (sub) item.append(node('p', sub, 'metric-sub'));
  $('metrics').append(item);
}

function renderReport(run) {
  const { result, spec } = run, metrics = result.metrics;
  $('empty-report').hidden = true;
  $('report-results').hidden = false;
  $('report-status').textContent = 'TEST COMPLETE';
  $('report-status').classList.add('complete');
  $('result-name').textContent = `${spec.symbol.replace('USDT', '')} / USDT · ${{ sma: 'MA crossover', rsi: 'RSI thresholds', hold: 'Buy & hold' }[spec.type]}`;
  $('result-period').textContent = `${date(result.period.start)} — ${date(result.period.end)}`;
  $('metrics').replaceChildren();
  renderMetric('Net return', percent(metrics.totalReturn, true), `${money(metrics.finalEquity)} USDT final equity`, metrics.totalReturn);
  renderMetric('Buy & hold return', percent(metrics.benchmarkReturn, true), 'Same costs and allocation', metrics.benchmarkReturn);
  renderMetric('Max drawdown', percent(metrics.maxDrawdown), 'Largest peak-to-trough decline');
  renderMetric('Net win rate', metrics.tradeCount ? percent(metrics.netWinRate) : '—', 'Completed trades, after fees');
  renderMetric('Completed trades', String(metrics.tradeCount), `${result.period.bars} daily bars in test`);
  renderMetric('Trading fees', `${money(metrics.totalFees)}`, 'USDT · slippage included in fills');
  $('trade-count').textContent = metrics.tradeCount;
  drawChart(result.equity);
  renderTrades(result.trades);
  renderEvidence(run);
  selectReportTab('equity', false);
}

function drawChart(points) {
  const NS = 'http://www.w3.org/2000/svg', width = 620, height = 280, left = 55, right = 12, top = 12, bottom = 34;
  const svg = document.createElementNS(NS, 'svg');
  const values = points.flatMap(point => [point.equity, point.benchmark]);
  const low = Math.min(...values), high = Math.max(...values), padding = (high - low || high * .05 || 1) * .12;
  const min = low - padding, max = high + padding;
  const x = i => left + i / Math.max(points.length - 1, 1) * (width - left - right);
  const y = value => top + (max - value) / (max - min) * (height - top - bottom);
  svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
  svg.setAttribute('role', 'img');
  svg.setAttribute('aria-label', `Equity in USDT for ${points.length} daily observations. Strategy equity at the first daily close is ${money(points[0].equity)} and ends at ${money(points.at(-1).equity)}; buy and hold ends at ${money(points.at(-1).benchmark)}.`);
  function element(tag, attributes, text) {
    const item = document.createElementNS(NS, tag);
    for (const [key, value] of Object.entries(attributes)) item.setAttribute(key, value);
    if (text !== undefined) item.textContent = text;
    svg.append(item);
  }
  for (let i = 0; i < 5; i++) {
    const value = min + (max - min) * i / 4, pos = y(value);
    element('line', { x1: left, x2: width - right, y1: pos, y2: pos, stroke: '#2a363b', 'stroke-width': 1 });
    element('text', { x: left - 9, y: pos + 3, fill: '#86999f', 'font-size': 10, 'text-anchor': 'end', 'font-family': 'ui-monospace, monospace' }, new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 }).format(value));
  }
  for (let i = 0; i < 4; i++) {
    const index = Math.round(i / 3 * (points.length - 1));
    element('text', { x: x(index), y: height - 10, fill: '#86999f', 'font-size': 10, 'text-anchor': i === 0 ? 'start' : i === 3 ? 'end' : 'middle' }, new Date(points[index].time).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' }));
  }
  for (const [key, color, dashed] of [['benchmark', '#82969d', true], ['equity', '#b8e5cb', false]]) {
    const attributes = { d: points.map((point, index) => `${index ? 'L' : 'M'}${x(index).toFixed(2)},${y(point[key]).toFixed(2)}`).join(' '), stroke: color, 'stroke-width': 2, fill: 'none', 'stroke-linejoin': 'round', 'stroke-linecap': 'round' };
    if (dashed) attributes['stroke-dasharray'] = '4 5';
    element('path', attributes);
  }
  $('equity-chart').replaceChildren(svg);
}

function renderTrades(trades) {
  const body = $('trade-body');
  body.replaceChildren();
  for (const trade of trades) {
    const row = node('tr'), timing = node('td', date(trade.entryTime));
    timing.append(node('small', `${date(trade.exitTime)} · ${trade.exitReason}`));
    row.append(timing, node('td', money(trade.entryPrice)), node('td', money(trade.exitPrice)), node('td', money(trade.fees)), node('td', `${trade.netPnl > 0 ? '+' : ''}${money(trade.netPnl)}`, trade.netPnl > 0 ? 'positive' : trade.netPnl < 0 ? 'negative' : ''));
    body.append(row);
  }
  if (!trades.length) {
    const cell = node('td', 'No completed trades in this period. The rules did not produce an executable entry.');
    cell.colSpan = 5;
    body.append(node('tr'));
    body.firstChild.append(cell);
  }
  $('trades-note').textContent = 'Prices include slippage. Net P&L subtracts both entry and exit fees. Remaining positions close at the final test close.';
}

function renderEvidence(run) {
  const list = $('evidence-details');
  const source = run.dataset.source;
  list.replaceChildren();
  addDefinition(list, 'Data source', typeof source === 'object' && source !== null ? source.name || JSON.stringify(source) : String(source));
  if (typeof source === 'string' && source.startsWith('https://')) {
    const link = node('a', 'Binance public historical data ↗');
    link.href = source;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.className = 'source-link';
    list.lastChild.replaceChildren(link);
  }
  addDefinition(list, 'Market', `${run.dataset.symbol} · ${run.dataset.interval} candles`);
  addDefinition(list, 'Snapshot', `${run.dataset.start} to ${run.dataset.end} · ${run.dataset.bars} bars`);
  addDefinition(list, 'Test period', `${date(run.result.period.start)} to ${date(run.result.period.end)}`);
  addDefinition(list, 'SHA-256', run.dataset.sha256);
  addDefinition(list, 'Interpreter', interpretationLabel(run.interpretation));
  addDefinition(list, 'Quote asset', 'USDT; equivalence to USD is not guaranteed');
  $('assumptions').replaceChildren(...run.result.assumptions.map(text => node('li', text)));
}

function selectReportTab(name, focus = true) {
  for (const key of ['equity', 'trades', 'evidence']) {
    $(`tab-${key}`).setAttribute('aria-selected', String(key === name));
    $(`tab-${key}`).tabIndex = key === name ? 0 : -1;
    $(`view-${key}`).hidden = key !== name;
  }
  if (focus) $(`tab-${name}`).focus();
}

function navigate(page, focus = true) {
  for (const key of ['research', 'methodology']) {
    $(`${key}-view`).hidden = page !== key;
    $(`nav-${key}`).classList.toggle('active', page === key);
    if (page === key) $(`nav-${key}`).setAttribute('aria-current', 'page');
    else $(`nav-${key}`).removeAttribute('aria-current');
  }
  $('page-crumb').textContent = page === 'research' ? 'Research' : 'Methodology';
  if (focus) $('main').focus();
}

async function exportEvidence() {
  if (!lastRun) return;
  const run = lastRun;
  try {
    const payload = { schemaVersion: 'crypto-strategy-lab/report/v1', generatedAt: new Date().toISOString(), engineVersion: '0.1.0', ...run };
    const payloadJson = JSON.stringify(payload);
    const report = { payload, integrity: { algorithm: 'SHA-256', serialization: 'JSON.stringify(payload)', sha256: await sha256(payloadJson) } };
    const url = URL.createObjectURL(new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' }));
    const link = node('a');
    link.href = url;
    link.download = `strategy-lab-${run.spec.symbol}-${run.options.startDate}.json`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    notice('Evidence exported with the dataset fingerprint and a SHA-256 checksum of the report payload.');
  } catch (error) { notice(`The evidence export failed: ${error.message}`, true); }
}

async function shareRun() {
  if (!lastRun) return;
  const url = new URL(location.href);
  url.hash = `draft=${encodeURIComponent(JSON.stringify({ v: 1, spec: lastRun.spec, options: lastRun.options }))}`;
  try {
    await navigator.clipboard.writeText(url.href);
    notice('Remix link copied. It contains the reviewed rules and settings; recipients must run their own test.');
  } catch {
    $('share-url').value = url.href;
    $('share-fallback').hidden = false;
    $('share-url').focus();
    $('share-url').select();
    notice('Copy the draft link shown below the report. Recipients must rerun the test.');
  }
}

function promptFromSpec(spec) {
  const symbol = spec.symbol.replace('USDT', '');
  if (spec.type === 'hold') return `Buy and hold ${symbol}.`;
  if (spec.type === 'rsi') return `Buy ${symbol} when RSI(${spec.period}) is below ${spec.entry}; sell when RSI is above ${spec.exit}.`;
  return `Buy ${symbol} when its ${spec.fast}-day moving average crosses above its ${spec.slow}-day moving average; sell on the reverse cross.`;
}

function restoreDraft() {
  if (!location.hash.startsWith('#draft=')) return;
  try {
    if (location.hash.length > 6000) throw new Error('The shared draft is too large.');
    const draft = JSON.parse(decodeURIComponent(location.hash.slice(7)));
    if (draft.v !== 1) throw new Error('The shared draft uses an unsupported version.');
    const spec = validateStrategy(draft.spec);
    for (const [key, min, max] of [['initialCash', 100, 1e6], ['feeBps', 0, 100], ['slippageBps', 0, 100], ['allocationPct', 1, 100]]) {
      const value = draft.options?.[key];
      if (!Number.isFinite(value) || value < min || value > max) throw new Error('The shared settings contain an invalid number.');
    }
    for (const key of ['startDate', 'endDate']) {
      const value = draft.options[key];
      if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value) || !Number.isFinite(Date.parse(`${value}T00:00:00Z`)) || date(`${value}T00:00:00Z`) !== value) throw new Error('The shared settings contain an invalid date.');
    }
    $('prompt').value = promptFromSpec(spec);
    $('symbol').value = spec.symbol;
    for (const [key, id] of [['initialCash', 'capital'], ['feeBps', 'fee'], ['slippageBps', 'slippage'], ['allocationPct', 'allocation'], ['startDate', 'start-date'], ['endDate', 'end-date']]) {
      if (typeof draft.options?.[key] !== (key.endsWith('Date') ? 'string' : 'number')) throw new Error('The shared settings are incomplete.');
      $(id).value = draft.options[key];
    }
    notice('Shared draft loaded. Review the rules and settings, then run a fresh backtest.');
  } catch (error) {
    $('prompt').value = examples.sma;
    $('symbol').value = 'BTCUSDT';
    notice(`Could not restore this draft: ${error.message}`, true);
  }
}

$('strategy-form').addEventListener('submit', reviewStrategy);
$('gemini-model').value = DEFAULT_GEMINI_MODEL;
$('interpreter').addEventListener('change', updateConnection);
for (const id of ['gemini-key', 'gemini-model']) $(id).addEventListener('input', invalidate);
$('clear-key').addEventListener('click', () => { $('gemini-key').value = ''; invalidate(); $('gemini-key').focus(); });
$('cancel-interpretation').addEventListener('click', () => { invalidate(); notice('Interpretation cancelled. A request already received by Google may still be billed.'); });
$('download-agent-task').addEventListener('click', () => { if (agentTask) downloadJson(agentTask, `strategy-task-${agentTask.id}.json`); });
$('agent-result').addEventListener('input', () => invalidate(true));
$('review-agent-result').addEventListener('click', reviewAgentResult);
$('agent-result-file').addEventListener('change', async () => {
  invalidate(true);
  const currentRevision = revision, file = $('agent-result-file').files[0];
  if (!file) return;
  try {
    if (file.size > 16384) throw new Error('Agent result must be JSON under 16 KiB.');
    const result = await file.text();
    if (currentRevision !== revision) return;
    $('agent-result').value = result;
    reviewAgentResult();
  } catch (error) { if (currentRevision === revision) formError(error.message); }
});
window.addEventListener('pagehide', () => { $('gemini-key').value = ''; interpretationRequest?.abort(); });
$('run-button').addEventListener('click', runReviewed);
$('retry-data').addEventListener('click', () => loadDataset());
for (const id of controls) $(id).addEventListener('input', invalidate);
$('symbol').addEventListener('change', () => loadDataset());
document.querySelectorAll('[data-example]').forEach(button => button.addEventListener('click', () => {
  invalidate();
  $('prompt').value = examples[button.dataset.example];
  const symbol = button.dataset.example === 'rsi' ? 'ETHUSDT' : 'BTCUSDT';
  if ($('symbol').value !== symbol) { $('symbol').value = symbol; loadDataset(); }
  $('prompt').focus();
}));
for (const page of ['research', 'methodology']) $(`nav-${page}`).addEventListener('click', () => navigate(page));
$('methodology-link').addEventListener('click', () => navigate('methodology'));
$('back-research').addEventListener('click', () => navigate('research'));
document.querySelector('.brand').addEventListener('click', event => { event.preventDefault(); navigate('research'); });
const tabs = ['equity', 'trades', 'evidence'];
for (const key of tabs) {
  $(`tab-${key}`).addEventListener('click', () => selectReportTab(key));
  $(`tab-${key}`).addEventListener('keydown', event => {
    let index = tabs.indexOf(key);
    if (event.key === 'ArrowRight') index = (index + 1) % tabs.length;
    else if (event.key === 'ArrowLeft') index = (index + tabs.length - 1) % tabs.length;
    else if (event.key === 'Home') index = 0;
    else if (event.key === 'End') index = tabs.length - 1;
    else return;
    event.preventDefault();
    selectReportTab(tabs[index]);
  });
}
$('export-button').addEventListener('click', exportEvidence);
$('share-button').addEventListener('click', shareRun);
restoreDraft();
loadDataset();

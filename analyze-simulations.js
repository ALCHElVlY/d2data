const fs = require('fs');

const ensureDir = (dir) => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
};

const safeName = (value) => value.toString().replace(/[^A-Za-z0-9._ \-\[\]\(\)]+/g, '_');

const mean = (values) => values.reduce((sum, v) => sum + v, 0) / (values.length || 1);

const stddev = (values, avg) => {
  if (values.length < 2) {
    return 0;
  }
  const variance = values.reduce((sum, v) => sum + Math.pow(v - avg, 2), 0) / (values.length - 1);
  return Math.sqrt(variance);
};

const normalSample = (avg, deviation) => {
  if (deviation <= 0) {
    return avg;
  }
  let u = 0;
  let v = 0;
  while (u === 0) {
    u = Math.random();
  }
  while (v === 0) {
    v = Math.random();
  }
  const z = Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
  return avg + deviation * z;
};

const buildDistribution = (values, samplesCount, binCount) => {
  const avg = mean(values);
  const deviation = stddev(values, avg);
  
  const spread = deviation > 0 ? deviation * 4 : Math.max(1, Math.abs(avg) * 0.1);
  const minX = avg - spread;
  const maxX = avg + spread;
  const bins = new Array(binCount).fill(0);
  const step = (maxX - minX) / binCount;

  for (let i = 0; i < samplesCount; i++) {
    const sample = normalSample(avg, deviation);
    const clamped = Math.max(minX, Math.min(maxX, sample));
    const idx = Math.min(binCount - 1, Math.max(0, Math.floor((clamped - minX) / step)));
    bins[idx] += 1;
  }

  const distribution = bins.map((count, index) => {
    const x = minX + step * (index + 0.5);
    const y = count / samplesCount;
    return { x, y };
  });

  const maxY = distribution.reduce((maxValue, point) => Math.max(maxValue, point.y), 0);

  return {
    avg,
    deviation,
    minX,
    maxX,
    minY: 0,
    maxY,
    distribution
  };
};

const formatNumber = (value) => {
  if (!Number.isFinite(value)) {
    return '0';
  }

  let digits = Math.log10(Math.abs(value));

  if (digits < -2) {
    return value.toExponential(2);
  }
  return value.toFixed(2);
};

const totalsdir = __dirname + '/simulation-totals/';
const graphsdir = __dirname + '/simulation-graphs/';

ensureDir(totalsdir);
ensureDir(graphsdir);

let datapoints = {};
let runs = {};
let fileCache = new Map();

const generateGraphsForItem = (tc, playermod, itc, data, runcount) => {
  const samplesCount = Math.max(5000, data.length * 200);
  const binCount = 60;
  const dist = buildDistribution(data, samplesCount, binCount);
  const safeBase = safeName(`${tc} [${playermod}][${itc}]`);
  const totalsPath = totalsdir + safeBase + '.json';
  const graphPath = graphsdir + safeBase + '.svg';

  const totalsPayload = {
    tc,
    playermod: Number(playermod),
    itc,
    runs: runcount,
    samples: data.length,
    mean: dist.avg,
    stddev: dist.deviation,
    minX: dist.minX,
    maxX: dist.maxX,
    minY: dist.minY,
    maxY: dist.maxY,
    distribution: dist.distribution
  };

  fs.writeFileSync(totalsPath, JSON.stringify(totalsPayload, null, 2));

  const plotWidth = 700;
  const plotHeight = 350;
  const gutterTop = 40;
  const gutterBottom = 30;
  const gutterX = 80;
  const width = gutterX + plotWidth + gutterX;
  const height = gutterTop + plotHeight + gutterBottom;
  const boxX = -gutterX;
  const boxY = -gutterTop;
  const rangeX = dist.maxX - dist.minX || 1;
  const rangeY = dist.maxY - dist.minY || 1;

  const points = dist.distribution.map((point, index) => {
    const x = ((point.x - dist.minX) / rangeX) * plotWidth;
    const y = plotHeight - ((point.y - dist.minY) / rangeY) * plotHeight;
    return `${index === 0 ? 'M' : 'L'} ${x.toFixed(2)} ${y.toFixed(2)}`;
  }).join(' ');

  const svg = [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="${boxX} ${boxY} ${width} ${height}">`,
    `<rect x="${boxX}" y="${boxY}" width="${width}" height="${height}" fill="#11161c"/>`,
    `<rect x="0" y="0" width="${plotWidth}" height="${plotHeight}" fill="#0b0f14" stroke="#2a323d" stroke-width="2"/>`,
    `<line x1="0" y1="${plotHeight}" x2="${plotWidth}" y2="${plotHeight}" stroke="#2a323d" stroke-width="2"/>`,
    `<line x1="0" y1="0" x2="0" y2="${plotHeight}" stroke="#2a323d" stroke-width="2"/>`,
    `<path d="${points}" fill="none" stroke="#8ad1ff" stroke-width="2"/>`,
    `<text x="${(width) / 2 - gutterX}" y="${-gutterTop / 2 + 5}" fill="#e6f0ff" font-size="18" text-anchor="middle">${tc} | players ${playermod * 2 - 1} | ${itc} | ${formatNumber(dist.avg)} ± ${formatNumber(dist.deviation)}</text>`,
    `<text x="0" y="${plotHeight + gutterBottom / 2 + 5}" fill="#d7e3f2" font-size="14" text-anchor="start">${formatNumber(dist.minX)}</text>`,
    `<text x="${plotWidth}" y="${plotHeight + gutterBottom / 2 + 5}" fill="#d7e3f2" font-size="14" text-anchor="end">${formatNumber(dist.maxX)}</text>`,
    `<text x="-10" y="${plotHeight + 4}" fill="#d7e3f2" font-size="14" text-anchor="end">${formatNumber(dist.minY)}</text>`,
    `<text x="-10" y="4" fill="#d7e3f2" font-size="14" text-anchor="end">${formatNumber(dist.maxY)}</text>`,
    `</svg>`
  ].join('');

  fs.writeFileSync(graphPath, svg);
};

const removeOutputsForItem = (tc, playermod, itc) => {
  const safeBase = safeName(`${tc} [${playermod}][${itc}]`);
  const totalsPath = totalsdir + safeBase + '.json';
  const graphPath = graphsdir + safeBase + '.svg';
  if (fs.existsSync(totalsPath)) {
    fs.unlinkSync(totalsPath);
  }
  if (fs.existsSync(graphPath)) {
    fs.unlinkSync(graphPath);
  }
};

const applySimulationData = (data, direction) => {
  if (!data || data.runs <= 0) {
    return [];
  }

  const affected = [];
  const tc = data.tc;
  const playermod = data.playermod;

  datapoints[tc] = datapoints[tc] || {};
  datapoints[tc][playermod] = datapoints[tc][playermod] || {};

  runs[tc] = runs[tc] || {};
  runs[tc][playermod] = runs[tc][playermod] || 0;
  runs[tc][playermod] += direction * data.runs;

  for (let item of data.drops) {
    let [itc, count] = item;
    datapoints[tc][playermod][itc] = datapoints[tc][playermod][itc] || [];
    if (direction > 0) {
      datapoints[tc][playermod][itc][data.seq] = count / data.runs;
    } else {
      delete datapoints[tc][playermod][itc][data.seq];
    }
    affected.push({ tc, playermod, itc });
  }

  return affected;
};

const rebuildAffectedItems = (affected) => {
  const unique = new Map();
  for (let item of affected) {
    unique.set(`${item.tc}||${item.playermod}||${item.itc}`, item);
  }

  for (let item of unique.values()) {
    const itemData = datapoints?.[item.tc]?.[item.playermod]?.[item.itc] || [];
    const runcount = runs?.[item.tc]?.[item.playermod] || 0;
    const hasValues = itemData.some(v => v !== undefined);

    if (!hasValues || runcount <= 0) {
      removeOutputsForItem(item.tc, item.playermod, item.itc);
      continue;
    }

    const normalized = itemData.map(v => v || 0);
    generateGraphsForItem(item.tc, item.playermod, item.itc, normalized, runcount);
  }
};

const processSimulationFile = (filePath, options = { rebuild: true }) => {
  try {
    const data = JSON.parse(fs.readFileSync(filePath));
    const previous = fileCache.get(filePath);
    let affected = [];

    if (previous) {
      affected = affected.concat(applySimulationData(previous, -1));
    }

    affected = affected.concat(applySimulationData(data, 1));
    fileCache.set(filePath, data);

    if (options.rebuild) {
      rebuildAffectedItems(affected);
    }
  } catch (err) {
    console.error(`Error processing file ${filePath}:`, err.message);
  }
};

const removeSimulationFile = (filePath) => {
  const previous = fileCache.get(filePath);
  if (!previous) {
    return;
  }

  const affected = applySimulationData(previous, -1);
  fileCache.delete(filePath);
  rebuildAffectedItems(affected);
};

// Initial build
console.log('Building initial graphs...');
for (let dir of [totalsdir, graphsdir]) {
  for (let file of fs.readdirSync(dir)) {
    if (file.endsWith('.json') || file.endsWith('.svg')) {
      fs.unlinkSync(dir + file);
    }
  }
}

for (let file of fs.readdirSync(__dirname + '/simulations/')) {
  if (file.endsWith('.json')) {
    processSimulationFile(__dirname + '/simulations/' + file, { rebuild: false });
  }
}

const allAffected = [];
for (let tc in datapoints) {
  for (let playermod in datapoints[tc]) {
    for (let itc in datapoints[tc][playermod]) {
      allAffected.push({ tc, playermod, itc });
    }
  }
}
rebuildAffectedItems(allAffected);
console.log('Initial build complete. Watching for changes...');

// Watch for file changes
const THROTTLE_MS = 250;
const lastHandled = new Map();

fs.watch(__dirname + '/simulations/', (eventType, filename) => {
  if (!filename || !filename.endsWith('.json')) {
    return;
  }

  const filePath = __dirname + '/simulations/' + filename;
  const now = Date.now();
  const last = lastHandled.get(filePath) || 0;
  if (now - last < THROTTLE_MS) {
    return;
  }
  lastHandled.set(filePath, now);

  if (!fs.existsSync(filePath)) {
    console.log(`Detected removal of ${filename}, rebuilding...`);
    removeSimulationFile(filePath);
    return;
  }

  console.log(`Detected ${eventType} on ${filename}, rebuilding...`);
  processSimulationFile(filePath);
});

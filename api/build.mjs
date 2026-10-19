import { execSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { copyFile, mkdir, readdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const API_VERSION = 1;
const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const distRoot = path.join(repoRoot, 'api', 'dist');
const apiRoot = path.join(distRoot, 'api', `v${API_VERSION}`);

const datasets = [
  { name: 'current', source: 'json' },
  { name: 'base', source: 'json/base' },
];

async function main() {
  const version = await readVersion();
  const sourceCommit = git('rev-parse HEAD');
  const repository = readRepository();

  await rm(distRoot, { recursive: true, force: true });

  const manifest = {
    apiVersion: API_VERSION,
    dataVersion: version.dataVersion,
    d2rBuild: version.d2rBuild,
    sourceCommit,
    generatedAt: new Date().toISOString(),
    datasets: {},
  };

  let tableCount = 0;
  let totalBytes = 0;

  for (const dataset of datasets) {
    const built = await buildDataset(dataset, repository, sourceCommit);
    manifest.datasets[dataset.name] = built;

    for (const table of Object.values(built.tables)) {
      tableCount++;
      totalBytes += table.bytes;
    }
  }

  await writeJson(path.join(apiRoot, 'manifest.json'), manifest);
  await writeJson(path.join(apiRoot, 'latest.json'), {
    apiVersion: manifest.apiVersion,
    dataVersion: manifest.dataVersion,
    d2rBuild: manifest.d2rBuild,
    sourceCommit: manifest.sourceCommit,
    generatedAt: manifest.generatedAt,
    manifest: 'manifest.json',
  });
  await writeFile(path.join(distRoot, 'index.html'), renderIndex(manifest));
  await writeFile(path.join(distRoot, '.nojekyll'), '');

  console.log(`Built API v${API_VERSION} for data ${manifest.dataVersion} (${sourceCommit.slice(0, 7)})`);
  console.log(`${tableCount} tables, ${(totalBytes / 1024 / 1024).toFixed(1)} MB -> ${path.relative(repoRoot, distRoot)}`);
}

async function readVersion() {
  const pkg = JSON.parse(await readFile(path.join(repoRoot, 'package.json'), 'utf8'));
  const build = Number(pkg.version.split('.')[2]);

  return {
    dataVersion: pkg.version,
    d2rBuild: Number.isInteger(build) ? build : null,
  };
}

/** Returns "owner/repo" for building commit-pinned raw.githubusercontent.com URLs. */
function readRepository() {
  if (process.env.GITHUB_REPOSITORY) {
    return process.env.GITHUB_REPOSITORY;
  }

  const match = git('remote get-url origin').match(/github\.com[:/](.+?\/.+?)(?:\.git)?$/);

  if (!match) {
    throw new Error('Could not determine the GitHub repository; set GITHUB_REPOSITORY.');
  }

  return match[1];
}

async function buildDataset(dataset, repository, sourceCommit) {
  const sourceDir = path.join(repoRoot, dataset.source);
  const outDir = path.join(apiRoot, dataset.name);
  const entries = await readdir(sourceDir, { withFileTypes: true });
  const files = entries
    .filter(entry => entry.isFile() && entry.name.endsWith('.json'))
    .map(entry => entry.name)
    .sort();

  if (files.length === 0) {
    throw new Error(`No JSON tables found in ${dataset.source}/`);
  }

  const tables = {};

  for (const file of files) {
    const name = file.slice(0, -'.json'.length);
    const data = JSON.parse(await readFile(path.join(sourceDir, file), 'utf8'));
    const bytes = await writeJson(path.join(outDir, file), data);

    tables[name] = {
      path: `${dataset.name}/${file}`,
      sha256: sha256(bytes),
      bytes: bytes.length,
      records: Array.isArray(data) ? data.length : Object.keys(data).length,
    };
  }

  return {
    tables,
    precalctc: await buildPrecalcIndex(dataset, repository, sourceCommit),
  };
}

/**
 * The precalctc drop tables are too large for GitHub Pages, so only their
 * index is published; clients fetch the files from the pinned commit.
 */
async function buildPrecalcIndex(dataset, repository, sourceCommit) {
  const indexFile = path.join(repoRoot, dataset.source, 'precalctc', '_index.json');

  if (!(await exists(indexFile))) {
    return null;
  }

  const outFile = path.join(apiRoot, dataset.name, 'precalctc', '_index.json');

  await mkdir(path.dirname(outFile), { recursive: true });
  await copyFile(indexFile, outFile);

  return {
    index: `${dataset.name}/precalctc/_index.json`,
    baseUrl: `https://raw.githubusercontent.com/${repository}/${sourceCommit}/${dataset.source}/precalctc/`,
  };
}

/** Writes minified JSON and returns the exact bytes written. */
async function writeJson(file, data) {
  const bytes = Buffer.from(JSON.stringify(data), 'utf8');

  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, bytes);

  return bytes;
}

function sha256(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}

async function exists(file) {
  try {
    await stat(file);
    return true;
  } catch {
    return false;
  }
}

function git(args) {
  return execSync(`git ${args}`, { cwd: repoRoot, encoding: 'utf8' }).trim();
}

function renderIndex(manifest) {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>d2data API</title>
</head>
<body>
<h1>d2data API v${manifest.apiVersion}</h1>
<p>Data version ${manifest.dataVersion}, built from commit <code>${manifest.sourceCommit}</code>.</p>
<ul>
<li><a href="api/v${manifest.apiVersion}/latest.json">latest.json</a></li>
<li><a href="api/v${manifest.apiVersion}/manifest.json">manifest.json</a></li>
</ul>
</body>
</html>
`;
}

await main();

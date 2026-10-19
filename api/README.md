# d2data static API

A read-only JSON API over the compiled Diablo II: Resurrected data in this repository, published
to GitHub Pages by [`publish-api.yml`](../.github/workflows/publish-api.yml).

The fork mirrors [blizzhackers/d2data](https://github.com/blizzhackers/d2data) through
[`sync-upstream.yml`](../.github/workflows/sync-upstream.yml). Every 6 hours that workflow merges
upstream and, if anything changed, rebuilds and redeploys the API.

**Base URL:** `https://alchelvly.github.io/d2data/api/v1/`

## Endpoints

| Path | Description |
|---|---|
| `latest.json` | Small version stamp. Poll this to check for updates. |
| `manifest.json` | Lists every table with its path, sha256, size and record count. |
| `current/<table>.json` | Tables from `json/`, the current game rules (e.g. `current/uniqueitems.json`). |
| `base/<table>.json` | Tables from `json/base/`, the game's `excel/base` rules. |
| `<dataset>/precalctc/_index.json` | Treasure class name → precalculated drop file name. |

Tables are minified but otherwise identical to the files in `json/`. They are objects keyed by
each table's index column (see `indexes` in [`compile.js`](../compile.js)), or by row number.
Every record has a `lineNumber` field.

### `latest.json`

```json
{
  "apiVersion": 1,
  "dataVersion": "3.3.93847",
  "d2rBuild": 93847,
  "sourceCommit": "a2ddc4c5a855423768056c5041b3dee715eb8690",
  "generatedAt": "2026-10-19T02:21:29.216Z",
  "manifest": "manifest.json"
}
```

### `manifest.json`

```json
{
  "apiVersion": 1,
  "dataVersion": "3.3.93847",
  "d2rBuild": 93847,
  "sourceCommit": "…",
  "generatedAt": "…",
  "datasets": {
    "current": {
      "tables": {
        "uniqueitems": { "path": "current/uniqueitems.json", "sha256": "…", "bytes": 151234, "records": 433 }
      },
      "precalctc": {
        "index": "current/precalctc/_index.json",
        "baseUrl": "https://raw.githubusercontent.com/ALCHElVlY/d2data/<sourceCommit>/json/precalctc/"
      }
    },
    "base": { "tables": { … }, "precalctc": { … } }
  }
}
```

All `path` and `index` values are relative to the base URL. `sha256` is the hash of the exact
bytes served.

## Keeping a client up to date

1. GET `latest.json`. If `sourceCommit` matches your cached value, you're done.
2. Otherwise GET `manifest.json`.
3. For each table you use, download it only if its `sha256` differs from your cached copy.
   Verify the hash after downloading.
4. Store the new `sourceCommit`.

`apiVersion` only changes when the API's shape breaks, and a new version is served under a new
path (`/api/v2/`). Data updates change `dataVersion` and `sourceCommit`, never `apiVersion`.

GitHub Pages serves the files gzip-compressed. Most HTTP clients, including Go's `net/http`,
decompress them automatically.

## Precalculated drop tables

The `precalctc` files total over 1 GB, which is more than GitHub Pages allows, so only the index
is published here. To fetch one treasure class:

1. Look up its file name in `<dataset>/precalctc/_index.json`.
2. URL-encode the file name, since many contain spaces.
3. Append it to the dataset's `precalctc.baseUrl`.

The `baseUrl` is pinned to `sourceCommit`, so the files always match the rest of the manifest.

## English names

`current/allstrings-eng.json` is a flat map from string key to display text. Look up:

| Data | Key |
|---|---|
| Base items (`items`, `armor`, `weapons`, `misc`) | `namestr` or `code`, e.g. `cap` → `Cap` |
| Unique items | `index`, e.g. `Harlequin Crest` |
| Set items and sets | `index` / set name |
| Runes | the rune code, e.g. `r01` → `El Rune` |
| Runewords (`runes`) | `Name`, e.g. `Runeword1` → `Ancients' Pledge` |

Other languages are in `current/localestrings-<lang>.json` (`chi`, `deu`, `esp`, `fra`, `ita`,
`kor`, `pol`).

## Examples

```bash
curl -s https://alchelvly.github.io/d2data/api/v1/latest.json
curl -s https://alchelvly.github.io/d2data/api/v1/current/runes.json
```

## Building locally

```bash
node api/build.mjs
```

This writes the site to `api/dist/`, which is gitignored. It needs only Node and git.

## Notes

- The workflows add new files only, so merging upstream never conflicts. Don't edit upstream-owned
  files such as `json/`, `package.json` or `.gitignore` in this fork.
- `GITHUB_TOKEN` cannot push commits that change `.github/workflows/`. If upstream ever adds a
  workflow, the sync push will fail and you'll need to merge that update by hand.

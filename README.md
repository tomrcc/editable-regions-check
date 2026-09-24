# editable-regions-check

Checks the editable region markup in a site's built HTML against the rules the
[`@cloudcannon/editable-regions`](../editable-regions) runtime relies on — for
example, that every `array-item` sits inside an `array`, and every array has a
way to create new items. Prototype; the intended home is a command in the
CloudCannon CLI.

```sh
npm run build
node dist/cli.js ../vue-test/.output/public           # pretty output
node dist/cli.js ./_site --format json --max-warnings 0
```

Exit code 1 means errors were found; 2 means warnings exceeded `--max-warnings`.

A config file (`--config path.json`) can set rule severities, extra region types
registered with `addCustomEditableRegion`, and globs to skip:

```json
{
	"rules": { "array-non-item-children": "off", "component-empty-prop": "error" },
	"customRegionTypes": ["map"],
	"ignore": ["admin/**"]
}
```

## Rules

See [RULES.md](RULES.md), generated from the rule definitions by `npm run docs`.

Each rule is a folder in `src/rules/<id>/` holding `rule.ts`, `valid/*.html` and
`invalid/*.html` fixtures, and a one-line `rule.test.ts`. To add a rule, copy a
folder, rename it, and add it to `src/rules/index.ts`. To remove one, delete the
folder and its line. `src/rules/rules.test.ts` fails if a folder and the index
disagree or a rule has no fixtures.

Invalid fixtures produce one diagnostic each unless they contain
`<!-- expect: N -->`. Their output is snapshotted; review snapshot changes with
`npx vitest run -u`.

Each rule's `sources` names the runtime code or docs it mirrors.
`src/model/drift.test.ts` compares the region types in `src/model/constants.ts`
against the sibling `editable-regions` checkout.

## Layout

- `src/parse.ts` — HTML → hast (parse5 via `hast-util-from-html`), with positions.
- `src/model/` — `buildRegionTree` turns a page into a tree of `RegionNode`s; the only thing rules read.
- `src/rules/` — one folder per rule.
- `src/check.ts` — runs rules, turning reports into `vfile` messages.
- `src/report/` — pretty (`vfile-reporter`) and JSON output.

Next phases add stages over the same `RegionNode` tree: resolving `data-prop`
paths (phase 2), then checking them against each page's frontmatter and data
files (phase 3).

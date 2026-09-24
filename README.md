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
node dist/cli.js ../vue-test/.output/public --source ../vue-test   # also check data
```

## Checking paths against content

Every `data-prop` is resolved to its full path the way the runtime does it:
relative to the nearest parent region, through the parent's `data-prop-*`
keys, and by position for array items (whose own `data-prop` the runtime
overwrites with their index).

With `--source <project root>`, each path is then looked up in the site's
content. The checker reads `cloudcannon.config.*` and maps each built page to
its source file by evaluating each collection's `url` template (`[slug]`,
`[full_slug]`, `{title|slugify}` and so on). Page paths are looked up in that
file's frontmatter, and `@collections[…]`, `@data[…]` and `@file[…]` paths in
the files they name. Pages that don't map to a file (404 pages, listing pages,
collections without a `url`) are listed in an info message, and only their
absolute paths are checked. A `url` template using a placeholder or filter the
checker doesn't know is reported as a warning, and that collection is skipped
rather than guessed at.

CloudCannon's order for a collection's files isn't known statically, so
`@collections[…]` array items are checked against every file in the collection.

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
- `src/model/` — `buildRegionTree` turns a page into a tree of `RegionNode`s; the only thing rules read. `resolvePaths` fills in each region's `bindings`: every `data-prop`/`data-prop-*` resolved to a root (the page, a collection, dataset or file) and path segments.
- `src/content/` — `buildSiteIndex` reads `cloudcannon.config.*`, parses content and data files, and maps output pages to source files through `url` templates. `lookup` walks a resolved path through that content.
- `src/rules/` — one folder per rule.
- `src/check.ts` — runs rules, turning reports into `vfile` messages.
- `src/report/` — pretty (`vfile-reporter`) and JSON output.

Each rule has a `phase`. `structure` rules read the markup, `paths` rules read
resolved bindings, and `data` rules look bindings up in the content, so they
only run with `--source`. A `data` rule's fixtures can have a sibling `.md`
file as the page's source file, and the rule folder a `source/` project (a
`cloudcannon.config.yml` plus files) for `@collections`, `@data` and `@file`
paths.

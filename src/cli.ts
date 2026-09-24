#!/usr/bin/env node
import { parseArgs } from "node:util";
import { checkSite } from "./check.ts";
import { type Config, loadConfig } from "./config.ts";
import { type Format, format, summarize } from "./report/formatters.ts";

const USAGE = `Usage: editable-regions-check <dir> [options]

Checks the editable region markup in every .html file under <dir>.

Options:
  --format <pretty|json>   Output format (default: pretty)
  --source <dir>           Project root with cloudcannon.config.*: also check each
                           data-prop against the page's source file and data
  --config <path>          JSON config file with rules, customRegionTypes, ignore
  --ignore <glob>          Skip matching files (repeatable)
  --max-warnings <n>       Exit with code 2 when there are more than n warnings
  -h, --help               Show this message`;

const { values, positionals } = parseArgs({
	allowPositionals: true,
	options: {
		format: { type: "string", default: "pretty" },
		source: { type: "string" },
		config: { type: "string" },
		ignore: { type: "string", multiple: true },
		"max-warnings": { type: "string" },
		help: { type: "boolean", short: "h" },
	},
});

const dir = positionals[0];
if (values.help || !dir) {
	console.log(USAGE);
	process.exit(values.help ? 0 : 1);
}

if (values.format !== "pretty" && values.format !== "json") {
	console.error(`Unknown format "${values.format}". Use "pretty" or "json".`);
	process.exit(1);
}

const config: Config = values.config ? await loadConfig(values.config) : {};
config.ignore = [...(config.ignore ?? []), ...(values.ignore ?? [])];

const files = await checkSite({ dir, source: values.source, config });
const summary = summarize(files);
const output = format(files, values.format as Format);
if (output) {
	console.log(output);
}

if (values.format === "pretty") {
	console.error(
		`Checked ${files.length - (values.source ? 1 : 0)} pages: ${summary.errors} errors, ${summary.warnings} warnings`,
	);
}

const maxWarnings = values["max-warnings"];
if (summary.errors > 0) {
	process.exit(1);
}
if (maxWarnings !== undefined && summary.warnings > Number(maxWarnings)) {
	process.exit(2);
}

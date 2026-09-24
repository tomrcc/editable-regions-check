import { parseSource } from "../../model/resolve-paths.ts";
import { defineRule } from "../define-rule.ts";

const ABSOLUTE_PREFIXES = ["@collections", "@data", "@file"];

export default defineRule({
	id: "prop-path-malformed",
	severity: "error",
	phase: "paths",
	regionTypes: "*",
	description:
		"`data-prop` paths must be dot-separated keys, and `@collections`, `@data` and `@file` need a `[key]` in matching brackets.",
	rationale:
		'The runtime splits paths on `.`, so an empty segment (`a..b`, `a.`) looks up the key `""`, which is never there. A malformed `@collections[…]`, `@data[…]` or `@file[…]` reference isn\'t recognised at all and is read as an unknown special prop. Either way the value is `undefined` and the region silently never becomes editable.',
	sources: ["editable-regions/nodes/editable.ts:106-173,684-763"],
	check(node, ctx) {
		for (const binding of node.bindings) {
			const { raw, attribute } = binding;
			const parsed = parseSource(raw);

			if (
				!parsed.absolute &&
				ABSOLUTE_PREFIXES.some((prefix) => raw.startsWith(prefix))
			) {
				const prefix = ABSOLUTE_PREFIXES.find((p) => raw.startsWith(p));
				ctx.report(
					node,
					`\`${attribute}="${raw}"\` isn't a valid ${prefix} reference`,
					{
						attribute,
						hint: `Write it as \`${prefix}[key]\` or \`${prefix}[key].path.to.value\`. If the key itself contains \`]\`, wrap it in more brackets, e.g. \`${prefix}[[key]]\`.`,
					},
				);
				continue;
			}

			if (parsed.source !== "" && parsed.source.split(".").includes("")) {
				ctx.report(
					node,
					`\`${attribute}="${raw}"\` has an empty path segment`,
					{
						attribute,
						hint: 'Remove the stray `.`. Use `data-prop=""` on its own to bind the parent\'s whole value.',
					},
				);
			}
		}
	},
});

import { SPECIAL_PROPS } from "../../model/resolve-paths.ts";
import { defineRule } from "../define-rule.ts";

const ABSOLUTE_PREFIXES = ["@collections", "@data", "@file"];

export default defineRule({
	id: "special-prop-out-of-scope",
	severity: "error",
	phase: "paths",
	regionTypes: "*",
	description:
		"`@index` must be inside an array item and `@length` inside an array. No other `@` names exist.",
	rationale:
		"Special props are passed down from the array or array item that provides them. Anywhere else, and for any other `@` name, the value is `undefined`, so the region silently never becomes editable.",
	sources: [
		"editable-regions/nodes/editable.ts:239-250,524-527",
		"editable-regions/nodes/editable-array.ts:541-550",
		"editable-regions/nodes/editable-array-item.ts:497-504",
	],
	check(node, ctx) {
		for (const binding of node.bindings) {
			const { resolved } = binding;
			if (resolved.status !== "special") {
				continue;
			}
			// Broken `@collections[…` references are reported by prop-path-malformed.
			if (
				ABSOLUTE_PREFIXES.some((prefix) => resolved.name.startsWith(prefix))
			) {
				continue;
			}

			if (!Object.hasOwn(SPECIAL_PROPS, resolved.name)) {
				ctx.report(
					node,
					`\`${binding.attribute}="${binding.raw}"\` isn't a special prop`,
					{
						attribute: binding.attribute,
						hint: `The only special props are ${Object.keys(SPECIAL_PROPS)
							.map((name) => `\`${name}\``)
							.join(
								" and ",
							)}. Other paths can't start with \`@\`, except \`@content\`, \`@collections[…]\`, \`@data[…]\` and \`@file[…]\`.`,
					},
				);
				continue;
			}

			const provider =
				SPECIAL_PROPS[resolved.name as keyof typeof SPECIAL_PROPS];
			let region: typeof node | null = node;
			while (region && region.type !== provider) {
				region = region.parent;
			}
			if (!region) {
				ctx.report(
					node,
					`\`${resolved.name}\` is only available inside ${provider === "array" ? "an array" : "an array item"}`,
					{ attribute: binding.attribute },
				);
			}
		}
	},
});

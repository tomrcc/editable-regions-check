import { defineRule } from "../define-rule.ts";

export default defineRule({
	id: "source-requires-key",
	severity: "error",
	phase: "structure",
	regionTypes: ["source"],
	description: "Source regions need a `data-key` attribute.",
	rationale:
		"The runtime finds the region in the raw source file by its `data-key`. Without it the runtime shows an error card instead of the content.",
	sources: ["editable-regions/nodes/editable-source.ts:72-83"],
	check(node, ctx) {
		if (!node.attributes.has("data-key")) {
			ctx.report(node, "Source region has no `data-key` attribute", {
				hint: "Add a `data-key` that is unique within the source file, e.g. `hero-title`.",
			});
		}
	},
});

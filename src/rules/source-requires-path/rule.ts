import { defineRule } from "../define-rule.ts";

export default defineRule({
	id: "source-requires-path",
	severity: "error",
	phase: "structure",
	regionTypes: ["source"],
	description:
		"Source regions need a `data-path` attribute naming the source file.",
	rationale:
		"Source regions edit a file's raw HTML. Without `data-path` the runtime shows an error card instead of the content.",
	sources: ["editable-regions/nodes/editable-source.ts:59-70"],
	check(node, ctx) {
		if (!node.attributes.has("data-path")) {
			ctx.report(node, "Source region has no `data-path` attribute", {
				hint: "Set `data-path` to the source file's path from the project root, e.g. `/src/pages/index.html`.",
			});
		}
	},
});

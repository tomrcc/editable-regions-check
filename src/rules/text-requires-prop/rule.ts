import { defineRule } from "../define-rule.ts";

export default defineRule({
	id: "text-requires-prop",
	severity: "error",
	phase: "structure",
	regionTypes: ["text"],
	description: "Text regions need a `data-prop` attribute.",
	rationale:
		'Without `data-prop` the runtime shows an error card instead of the text. An empty `data-prop=""` is valid and binds the parent\'s value, e.g. a plain-string array item.',
	sources: ["editable-regions/nodes/editable-text.ts:20-29"],
	check(node, ctx) {
		if (node.props.base === undefined) {
			ctx.report(node, "Text region has no `data-prop` attribute", {
				hint: "Add `data-prop` with the field's path. Use `data-prop=\"\"` to bind the parent's value, e.g. inside a plain-string array item.",
			});
		}
	},
});

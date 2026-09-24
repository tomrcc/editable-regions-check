import { defineRule } from "../define-rule.ts";

export default defineRule({
	id: "array-requires-prop",
	severity: "error",
	phase: "structure",
	regionTypes: ["array"],
	description: "Array regions need a `data-prop` attribute.",
	rationale:
		"Without `data-prop` the runtime shows an error card instead of the array.",
	sources: ["editable-regions/nodes/editable-array.ts:105-114"],
	check(node, ctx) {
		if (node.props.base === undefined) {
			ctx.report(node, "Array region has no `data-prop` attribute", {
				hint: "Add `data-prop` with the array's path. Use `data-prop=\"\"` when the parent's value is the array.",
			});
		}
	},
});

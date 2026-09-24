import { TEXT_DATA_TYPES } from "../../model/constants.ts";
import { defineRule } from "../define-rule.ts";

export default defineRule({
	id: "text-invalid-type",
	severity: "error",
	phase: "structure",
	regionTypes: ["text", "source"],
	description: "`data-type` must be `span`, `text` or `block`.",
	rationale:
		"The runtime shows an error card instead of the text when `data-type` has any other value.",
	sources: ["editable-regions/nodes/editable-text.ts:33-45"],
	check(node, ctx) {
		const type = node.attributes.get("data-type");
		if (
			type !== undefined &&
			!(TEXT_DATA_TYPES as readonly string[]).includes(type)
		) {
			ctx.report(node, `"${type}" is not a valid \`data-type\``, {
				attribute: "data-type",
				hint: "Use `span` for plain text, `text` for inline rich text, or `block` for multi-paragraph rich text.",
			});
		}
	},
});

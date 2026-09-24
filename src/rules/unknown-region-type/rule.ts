import { ATTRIBUTE_REGION_TYPES } from "../../model/constants.ts";
import { defineRule } from "../define-rule.ts";

export default defineRule({
	id: "unknown-region-type",
	severity: "error",
	phase: "structure",
	regionTypes: "*",
	description:
		"`data-editable` must name a known region type, and `<editable-*>` elements must be known region elements.",
	rationale:
		"The runtime replaces an element with an unknown `data-editable` type with an error card. An unknown `<editable-*>` element never hydrates, but still counts as the parent region for everything inside it.",
	sources: [
		"editable-regions/helpers/hydrate-editable-regions.ts:15-22,87-103",
		"editable-regions/nodes/editable.ts:480-494",
	],
	check(node, ctx) {
		if (node.kind !== "unknown") {
			return;
		}

		if (node.form === "element") {
			ctx.report(
				node,
				`\`<${node.tagName}>\` is not an editable region element`,
				{
					hint: "Elements starting with `editable-` are treated as editable regions. Rename the element if it isn't one.",
				},
			);
			return;
		}

		const valid = ATTRIBUTE_REGION_TYPES.map((type) => `"${type}"`).join(", ");
		ctx.report(node, `"${node.type}" is not a valid \`data-editable\` type`, {
			attribute: "data-editable",
			hint: `Valid types are ${valid}. If this is intentional, add \`data-cloudcannon-ignore\` or register it in \`customRegionTypes\`.`,
		});
	},
});

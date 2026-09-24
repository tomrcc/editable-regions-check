import { liveItems } from "../../model/region-tree.ts";
import { defineRule } from "../define-rule.ts";

export default defineRule({
	id: "array-keyed-item-missing-id",
	severity: "warn",
	phase: "structure",
	regionTypes: ["array"],
	description:
		"When an array sets `data-id-key` or `data-component-key`, each item needs a `data-id` or `data-component`.",
	rationale:
		"A keyed array matches items to its data by `data-id` (falling back to `data-component`). An item with neither never matches, so it's thrown away and rebuilt on every update, losing its live DOM.",
	sources: ["editable-regions/nodes/editable-array.ts:270,338-375"],
	check(node, ctx) {
		const key =
			node.attributes.get("data-id-key") ??
			node.attributes.get("data-component-key");
		if (!key) {
			return;
		}

		for (const item of liveItems(node)) {
			if (
				!item.attributes.has("data-id") &&
				!item.attributes.has("data-component")
			) {
				ctx.report(
					item,
					"Array item has no `data-id` or `data-component`, so it can't be matched to its data",
					{
						hint: `The array matches items by each value's \`${key}\` field. Set \`data-id\` (or \`data-component\`) on the item to that value.`,
					},
				);
			}
		}
	},
});

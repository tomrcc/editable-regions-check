import type { Element } from "hast";
import {
	elementChildren,
	findDescendant,
	liveItems,
} from "../../model/region-tree.ts";
import { defineRule } from "../define-rule.ts";

const ALLOWED_TAGS = new Set(["template", "script", "style", "noscript"]);

export default defineRule({
	id: "array-non-item-children",
	severity: "warn",
	phase: "structure",
	regionTypes: ["array"],
	description:
		"Every direct child of an array region should be, or contain, one of its array items.",
	rationale:
		'Static siblings inside an array (a logo, a "see all" link) are left behind or duplicated when items are added, removed or reordered. Split the layout container from the array container; `display: contents` on the array wrapper keeps grid and flex layouts intact.',
	sources: [
		"docs: visual-editing-reference.md § Don't mix array items with non-array siblings",
	],
	check(node, ctx) {
		const items = new Set<Element>(liveItems(node).map((item) => item.element));
		if (items.size === 0) {
			// `array-requires-items` covers arrays with no items at all.
			return;
		}

		for (const child of elementChildren(node.element)) {
			if (
				ALLOWED_TAGS.has(child.tagName) ||
				items.has(child) ||
				findDescendant(child, (el) => items.has(el))
			) {
				continue;
			}

			ctx.report(
				node,
				`Array region contains a \`<${child.tagName}>\` that isn't an array item`,
				{
					hint: "Move static content outside the array element, so every child of the array is an item.",
				},
			);
		}
	},
});

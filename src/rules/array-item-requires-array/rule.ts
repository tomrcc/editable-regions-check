import { defineRule } from "../define-rule.ts";

export default defineRule({
	id: "array-item-requires-array",
	severity: "error",
	phase: "structure",
	regionTypes: ["array-item"],
	description:
		"Array items must be nested inside an array region, with no other region in between.",
	rationale:
		"The runtime checks the nearest parent region. If it isn't an array, the item shows an error card and gets no controls. A common cause is double nesting: a component whose output starts with its own `array-item`, inside the `array-item` the page template already adds.",
	sources: ["editable-regions/nodes/editable-array-item.ts:34-48"],
	check(node, ctx) {
		const parent = node.parent;
		// A `_dynamic` wrapper's real type is only known at runtime.
		if (parent?.type === "array" || parent?.kind === "dynamic") {
			return;
		}

		ctx.report(
			node,
			parent
				? `Array item's nearest parent region is \`${parent.type}\`, not \`array\``
				: "Array item is not inside an array region",
			{
				hint:
					parent?.type === "array-item"
						? "This looks like double nesting. Keep the `array-item` in the page template and remove it from the component's output."
						: 'Wrap the items in an element with `data-editable="array"` and a `data-prop` for the array.',
			},
		);
	},
});

import { defineRule } from "../define-rule.ts";

export default defineRule({
	id: "prop-unbound",
	severity: "error",
	phase: "paths",
	regionTypes: "*",
	description:
		"A relative `data-prop` must be able to reach a value through its parent region's `data-prop` or `data-prop-*` attributes.",
	rationale:
		"A region looks its path up in its parent region's value, which is built from the parent's `data-prop` plus one key per `data-prop-*`. If the parent has no `data-prop` and no matching `data-prop-*`, or no props at all, the value is always `undefined`, so the region silently never becomes editable.",
	sources: [
		"editable-regions/nodes/editable.ts:106-173,239-310,505-565",
		"editable-regions/nodes/editable-array.ts:42-100",
	],
	check(node, ctx) {
		for (const binding of node.bindings) {
			if (binding.resolved.status === "unbound") {
				ctx.report(
					node,
					`\`${binding.attribute}="${binding.raw}"\` never gets a value: ${binding.resolved.reason}`,
					{
						attribute: binding.attribute,
						hint: "Give the parent region a `data-prop` (or a `data-prop-*` named after this path's first key), or make this path absolute with `@file[…]`, `@data[…]` or `@collections[…]`.",
					},
				);
			}
		}
	},
});

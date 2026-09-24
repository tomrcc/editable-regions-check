import { defineRule } from "../define-rule.ts";

export default defineRule({
	id: "component-empty-prop",
	severity: "warn",
	phase: "structure",
	regionTypes: ["component"],
	description: 'Component regions shouldn\'t use `data-prop=""`.',
	rationale:
		'The component controls treat an empty `data-prop` as missing, so the component gets no edit button. Primitive regions can use `data-prop=""`; components need a real key.',
	sources: [
		"docs: visual-editing-reference.md § Empty `data-prop` pass-through",
	],
	check(node, ctx) {
		if (node.props.base === "") {
			ctx.report(node, 'Component region has an empty `data-prop=""`', {
				attribute: "data-prop",
				hint: "Point `data-prop` at the object holding the component's data, nesting the frontmatter under a key if needed.",
			});
		}
	},
});

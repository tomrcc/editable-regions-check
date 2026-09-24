import { defineRule } from "../define-rule.ts";

export default defineRule({
	id: "value-region-has-children",
	severity: "warn",
	phase: "structure",
	regionTypes: ["text", "image", "source"],
	description:
		"Text, image and source regions shouldn't contain other regions.",
	rationale:
		"Value regions own their contents: text and source regions replace their inner HTML with an editor, so any regions inside them are lost as soon as editing starts.",
	sources: ["editable-regions/README.md:509"],
	check(node, ctx) {
		for (const child of node.children) {
			// Snippets live inside rich text by design.
			if (child.type === "snippet") {
				continue;
			}
			ctx.report(
				child,
				`\`${child.type}\` region is nested inside a \`${node.type}\` region`,
				{
					hint: `Move the \`${node.type}\` region onto an element that holds only its own value.`,
				},
			);
		}
	},
});

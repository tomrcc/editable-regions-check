import { defineRule } from "../define-rule.ts";

export default defineRule({
	id: "prop-attr-hyphenated",
	severity: "warn",
	phase: "structure",
	regionTypes: "*",
	description:
		"`data-prop-*` and `data-literal-*` names shouldn't contain hyphens.",
	rationale:
		"The runtime reads the name through `dataset` and lowercases it, so `data-prop-author-name` becomes the key `authorname`, not `author-name` or `authorName`. HTML also lowercases attribute names, so camelCase in the attribute doesn't survive either.",
	sources: ["editable-regions/nodes/editable.ts:193-217,514-515"],
	check(node, ctx) {
		for (const prop of [...node.props.named, ...node.props.literal]) {
			const prefix = prop.attribute.startsWith("data-prop-")
				? "data-prop-"
				: "data-literal-";
			if (prop.attribute.slice(prefix.length).includes("-")) {
				ctx.report(
					node,
					`\`${prop.attribute}\` is read as the key \`${prop.key}\``,
					{
						attribute: prop.attribute,
						hint: "Use a single-word name, or bind an object with `data-prop` and read the field from it.",
					},
				);
			}
		}
	},
});

import { IMAGE_PROP_ATTRIBUTES } from "../../model/constants.ts";
import { defineRule } from "../define-rule.ts";

/** The keys each region type accepts from `data-prop-*` and `data-literal-*`. */
const ALLOWED_KEYS: Record<string, readonly string[]> = {
	image: IMAGE_PROP_ATTRIBUTES.filter((name) => name !== "data-prop").map(
		(name) => name.slice("data-prop-".length),
	),
	text: [],
	source: [],
	array: [],
};

/** Likely intended image keys for common misspellings. */
const IMAGE_KEY_SUGGESTIONS: Record<string, string> = {
	source: "src",
	url: "src",
	image: "src",
	path: "src",
	caption: "alt",
	description: "alt",
};

export default defineRule({
	id: "unsupported-named-prop",
	severity: "error",
	phase: "structure",
	regionTypes: Object.keys(ALLOWED_KEYS),
	description:
		"Text, source and array regions don't accept `data-prop-*` or `data-literal-*` attributes, and image regions only accept `src`, `alt` and `title`.",
	rationale:
		"Every `data-prop-*` and `data-literal-*` attribute adds a key to the region's value, turning it into an object. Text and source regions expect a string and array regions expect an array, so they show an error card (for source regions, one that wrongly says the file doesn't exist). Image regions show an error card for any key other than `src`, `alt` or `title`.",
	sources: [
		"editable-regions/nodes/editable.ts:255-297,503-517",
		"editable-regions/nodes/editable-image.ts:103-123",
		"editable-regions/nodes/editable-text.ts:51-73",
		"editable-regions/nodes/editable-source.ts:88-103",
		"editable-regions/nodes/editable-array.ts:121-146",
	],
	check(node, ctx) {
		const allowed = ALLOWED_KEYS[node.type] ?? [];
		for (const prop of [...node.props.named, ...node.props.literal]) {
			if (allowed.includes(prop.key)) {
				continue;
			}
			const prefix = prop.attribute.startsWith("data-prop-")
				? "data-prop-"
				: "data-literal-";

			if (node.type === "image") {
				const suggestion = IMAGE_KEY_SUGGESTIONS[prop.key];
				ctx.report(node, `\`${prop.attribute}\` isn't an image attribute`, {
					attribute: prop.attribute,
					hint: suggestion
						? `Did you mean \`${prefix}${suggestion}\`?`
						: `Image regions accept \`${prefix}src\`, \`${prefix}alt\` and \`${prefix}title\`.`,
				});
			} else {
				ctx.report(
					node,
					`\`${prop.attribute}\` turns the ${node.type} region's value into an object`,
					{
						attribute: prop.attribute,
						hint:
							node.type === "source"
								? "Source regions read their value from `data-path` and `data-key`. Remove the attribute."
								: `${node.type === "text" ? "Text" : "Array"} regions only read \`data-prop\`. Point it at the field, or remove the attribute.`,
					},
				);
			}
		}
	},
});

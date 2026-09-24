import { IMAGE_PROP_ATTRIBUTES } from "../../model/constants.ts";
import { defineRule } from "../define-rule.ts";

export default defineRule({
	id: "image-requires-prop",
	severity: "error",
	phase: "structure",
	regionTypes: ["image"],
	description:
		"Image regions need at least one of `data-prop`, `data-prop-src`, `data-prop-alt` or `data-prop-title`.",
	rationale:
		"Without one the runtime shows an error card instead of the image.",
	sources: ["editable-regions/nodes/editable-image.ts:46-55"],
	check(node, ctx) {
		if (!IMAGE_PROP_ATTRIBUTES.some((name) => node.attributes.has(name))) {
			ctx.report(
				node,
				"Image region has no `data-prop` or `data-prop-src`/`-alt`/`-title` attribute",
				{
					hint: "Use `data-prop` for an object with `src`/`alt`/`title` keys, or `data-prop-src` (and `-alt`, `-title`) for separate fields.",
				},
			);
		}
	},
});

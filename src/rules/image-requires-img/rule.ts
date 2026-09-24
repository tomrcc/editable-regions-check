import { findDescendant } from "../../model/region-tree.ts";
import { defineRule } from "../define-rule.ts";

export default defineRule({
	id: "image-requires-img",
	severity: "error",
	phase: "structure",
	regionTypes: ["image"],
	description: "Image regions must be an `<img>` or contain one.",
	rationale:
		"The runtime updates `src`, `alt` and `title` on an `<img>`. Without one it shows an error card.",
	sources: ["editable-regions/nodes/editable-image.ts:31-40"],
	check(node, ctx) {
		if (
			node.tagName !== "img" &&
			!findDescendant(node.element, (el) => el.tagName === "img")
		) {
			ctx.report(node, "Image region has no `<img>` element", {
				hint: "Put the region on the `<img>`, or on an element that contains it.",
			});
		}
	},
});

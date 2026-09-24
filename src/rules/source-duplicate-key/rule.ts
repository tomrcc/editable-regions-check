import type { RegionNode } from "../../model/region-tree.ts";
import { defineRule } from "../define-rule.ts";

/** The runtime adds a leading slash when it's missing (`editable-source.ts`). */
const normalizePath = (path: string) =>
	path.startsWith("/") ? path : `/${path}`;

export default defineRule({
	id: "source-duplicate-key",
	severity: "error",
	phase: "structure",
	regionTypes: [],
	description: "Each `data-key` must appear once per source file.",
	rationale:
		"The runtime locates a source region by searching the file for its `data-key`. If the key appears more than once, it can't tell which region to edit and shows an error card. This rule catches duplicates visible on one page; the runtime checks the raw file.",
	sources: ["editable-regions/nodes/editable-source.ts:103-145"],
	checkPage(page, ctx) {
		const seen = new Map<string, RegionNode>();
		for (const node of page.regions) {
			const path = node.attributes.get("data-path");
			const key = node.attributes.get("data-key");
			if (node.type !== "source" || node.inTemplate || !path || !key) {
				continue;
			}

			const id = `${normalizePath(path)}\0${key}`;
			const first = seen.get(id);
			if (first) {
				ctx.report(
					node,
					`\`data-key="${key}"\` is used more than once for ${normalizePath(path)}`,
					{
						attribute: "data-key",
						hint: `The first use is on line ${first.position?.start.line}. Give each source region in a file its own key.`,
					},
				);
			} else {
				seen.set(id, node);
			}
		}
	},
});

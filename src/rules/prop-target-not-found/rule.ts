import { lookupBinding } from "../../content/lookup.ts";
import { parseSource } from "../../model/resolve-paths.ts";
import { defineRule } from "../define-rule.ts";

export default defineRule({
	id: "prop-target-not-found",
	severity: "error",
	phase: "data",
	regionTypes: "*",
	description:
		"`@collections[…]`, `@data[…]` and `@file[…]` must name a collection, dataset or file that exists.",
	rationale:
		"The runtime looks the reference up with `CloudCannon.collection`, `CloudCannon.dataset` or `CloudCannon.file`. If there's nothing by that name, the region gets no value and silently never becomes editable.",
	sources: [
		"editable-regions/nodes/editable.ts:529-557,707-763",
		"cloudcannon.config: collections_config, data_config",
	],
	check(node, ctx) {
		if (!ctx.content) {
			return;
		}
		for (const binding of node.bindings) {
			// Report on the attribute that names the reference, not on every region under it.
			if (!parseSource(binding.raw).absolute) {
				continue;
			}
			const result = lookupBinding(ctx.content, binding).find(
				(r) => r.outcome === "no-target",
			);
			if (result) {
				ctx.report(node, result.message, {
					attribute: binding.attribute,
					hint: "Collection and dataset keys come from `collections_config` and `data_config` in your CloudCannon configuration. `@file[…]` paths are relative to the site source.",
				});
			}
		}
	},
});

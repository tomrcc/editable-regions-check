import { defineRule } from "../define-rule.ts";

export default defineRule({
	id: "component-requires-component",
	severity: "error",
	phase: "structure",
	regionTypes: ["component"],
	description: "Component regions need a non-empty `data-component` attribute.",
	rationale:
		"`data-component` names the registered renderer. Without it the runtime shows an error card instead of the component.",
	sources: ["editable-regions/nodes/editable-component.ts:43-53"],
	check(node, ctx) {
		if (!node.attributes.get("data-component")) {
			ctx.report(node, "Component region has no `data-component` attribute", {
				hint: "Set `data-component` to the key the component is registered under.",
			});
		}
	},
});

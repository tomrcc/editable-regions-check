import { liveItems } from "../../model/region-tree.ts";
import { defineRule } from "../define-rule.ts";

export default defineRule({
	id: "array-requires-items",
	severity: "error",
	phase: "structure",
	regionTypes: ["array"],
	description:
		"An array region needs at least one array item, a `<template>`, or a `data-component`/`data-component-key` attribute.",
	rationale:
		"New items are built by copying an existing item, cloning a `<template>`, or rendering a registered component. With none of those, adding an item shows an error card.",
	sources: [
		"editable-regions/nodes/editable-array.ts:270,290-316",
		"docs: visual-editing-reference.md § When HTML <template> blueprints are needed",
	],
	check(node, ctx) {
		if (
			liveItems(node).length > 0 ||
			node.templates.length > 0 ||
			node.attributes.has("data-component") ||
			node.attributes.has("data-component-key") ||
			node.attributes.has("data-id-key")
		) {
			return;
		}

		ctx.report(
			node,
			"Array region has no array items and no way to create one",
			{
				hint: 'Add `data-editable="array-item"` to each item, or add a `<template>` holding one item\'s markup for arrays that can be empty.',
			},
		);
	},
});

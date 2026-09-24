import { defineRule } from "../define-rule.ts";

/** Elements whose content model only allows inline (phrasing) content. */
const PHRASING_HOSTS = new Set([
	"a",
	"b",
	"button",
	"em",
	"h1",
	"h2",
	"h3",
	"h4",
	"h5",
	"h6",
	"i",
	"label",
	"p",
	"small",
	"span",
	"strong",
]);

export default defineRule({
	id: "block-in-phrasing-host",
	severity: "warn",
	phase: "structure",
	regionTypes: ["text", "source"],
	description:
		'`data-type="block"` regions should be on an element that can hold block content.',
	rationale:
		"Block text can contain lists, headings and multiple paragraphs. A `<p>` can't hold those, so the browser closes it early and the content spills out of the region. Other inline elements don't break the parse but produce invalid HTML.",
	sources: [
		"docs: troubleshooting.md § Block content breaks the DOM around a region",
	],
	check(node, ctx) {
		if (
			node.attributes.get("data-type") === "block" &&
			PHRASING_HOSTS.has(node.tagName)
		) {
			ctx.report(
				node,
				`\`data-type="block"\` region is on a \`<${node.tagName}>\`, which can't contain block content`,
				{
					attribute: "data-type",
					hint: 'Use a `<div>` (or another block container) as the host, or `data-type="text"` for single-paragraph rich text.',
				},
			);
		}
	},
});

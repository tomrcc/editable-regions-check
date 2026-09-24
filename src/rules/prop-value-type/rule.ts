import {
	describeBinding,
	listFiles,
	withArticle,
} from "../../content/describe.ts";
import { FilesValue, FileValue, lookupBinding } from "../../content/lookup.ts";
import type { SourceFile } from "../../content/site-index.ts";
import type { RegionNode } from "../../model/region-tree.ts";
import { type Binding, formatPath } from "../../model/resolve-paths.ts";
import { defineRule, type RuleContext } from "../define-rule.ts";

interface Expectation {
	/** How the error card words it, e.g. `a string`. */
	expected: string;
	accepts(value: unknown): boolean;
}

const STRING: Expectation = {
	expected: "a string",
	accepts: (value) => typeof value === "string" || value === null,
};

/** `EditableArray.validateValue` (`editable-array.ts:121-151`). */
const ARRAY: Expectation = {
	expected: "an array",
	accepts: (value) =>
		Array.isArray(value) ||
		value === null ||
		value instanceof FilesValue ||
		value instanceof FileValue,
};

/** `EditableImage.validateValue` (`editable-image.ts:61-100`): `typeof value === "object"`. */
const IMAGE_OBJECT: Expectation = {
	expected: "an object with `src`, `alt` and `title`",
	accepts: (value) =>
		typeof value === "object" &&
		!(value instanceof FileValue) &&
		!(value instanceof FilesValue),
};

const IMAGE_KEYS = ["src", "alt", "title"];

/** What each region type expects from each binding. `undefined` means the runtime doesn't check. */
const expectationFor = (
	node: RegionNode,
	binding: Binding,
): Expectation | undefined => {
	switch (node.type) {
		case "text":
			return binding.key === undefined ? STRING : undefined;
		case "array":
			return binding.key === undefined ? ARRAY : undefined;
		case "image":
			if (binding.key === undefined) {
				return IMAGE_OBJECT;
			}
			return IMAGE_KEYS.includes(binding.key) ? STRING : undefined;
		default:
			return undefined;
	}
};

const report = (
	ctx: RuleContext,
	node: RegionNode,
	binding: Binding,
	path: string,
	expected: string,
	actual: unknown,
	files: SourceFile[],
) => {
	const where = files.length > 0 ? ` in ${listFiles(files)}` : "";
	ctx.report(
		node,
		`${describeBinding(node, binding)} points at \`${path}\`, which is ${withArticle(actual)}${where}. ${node.type[0].toUpperCase()}${node.type.slice(1)} regions need ${expected}`,
		{ attribute: binding.attribute },
	);
};

export default defineRule({
	id: "prop-value-type",
	severity: "error",
	phase: "data",
	regionTypes: ["text", "array", "image"],
	description:
		"The value a `data-prop` points at must be the type its region expects: a string for text, an array for arrays, and an object of strings for images.",
	rationale:
		"Each region validates its value before rendering. Text regions need a string, arrays need an array (or a collection, dataset or file), and images need an object whose `src`, `alt` and `title` are strings. Any other type shows an error card in place of the region. `null` is always accepted.",
	sources: [
		"editable-regions/nodes/editable-text.ts:51-75",
		"editable-regions/nodes/editable-array.ts:121-151",
		"editable-regions/nodes/editable-image.ts:61-100",
	],
	check(node, ctx) {
		if (!ctx.content) {
			return;
		}
		for (const binding of node.bindings) {
			const expectation = expectationFor(node, binding);
			if (!expectation || binding.resolved.status !== "path") {
				continue;
			}
			const path = formatPath(binding.resolved.root, binding.resolved.segments);
			const found = lookupBinding(ctx.content, binding).flatMap((result) =>
				result.outcome === "found" ? [result] : [],
			);

			const wrong = found.filter(
				(result) => !expectation.accepts(result.value),
			);
			if (wrong.length > 0) {
				report(
					ctx,
					node,
					binding,
					path,
					expectation.expected,
					wrong[0].value,
					wrong.flatMap((result) => (result.via ? [result.via] : [])),
				);
				continue;
			}

			// An image's object can carry `src`, `alt` and `title` itself.
			if (node.type === "image" && binding.key === undefined) {
				for (const key of IMAGE_KEYS) {
					if (node.bindings.some((other) => other.key === key)) {
						continue;
					}
					const bad = found.filter((result) => {
						const value = result.value as Record<string, unknown> | null;
						return value && key in value && !STRING.accepts(value[key]);
					});
					if (bad.length > 0) {
						const value = (bad[0].value as Record<string, unknown>)[key];
						report(
							ctx,
							node,
							binding,
							`${path}.${key}`,
							"`src`, `alt` and `title` to be strings",
							value,
							bad.flatMap((result) => (result.via ? [result.via] : [])),
						);
					}
				}
			}
		}
	},
});

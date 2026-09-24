import {
	availableKeys,
	closestKey,
	describeBinding,
	listFiles,
	withArticle,
} from "../../content/describe.ts";
import {
	FilesValue,
	FileValue,
	type LookupResult,
	lookupBinding,
	type PageContent,
} from "../../content/lookup.ts";
import type { SourceFile } from "../../content/site-index.ts";
import type { RegionNode } from "../../model/region-tree.ts";
import {
	type Binding,
	formatPath,
	type PathRoot,
	type Segment,
} from "../../model/resolve-paths.ts";
import { defineRule, type RuleContext } from "../define-rule.ts";

type Missing = Extract<LookupResult, { outcome: "missing" }>;

const describeRoot = (root: PathRoot, content: PageContent): string => {
	switch (root.kind) {
		case "page":
			return `the page's source file \`${content.file?.path}\``;
		case "collection":
			return `\`@collections[${root.key}]\``;
		case "data":
			return `\`@data[${root.key}]\``;
		case "file":
			return `\`@file[${root.path}]\``;
	}
};

const describeContainer = (
	root: PathRoot,
	segments: Segment[],
	missing: Missing,
	content: PageContent,
): string => {
	const segment = segments[missing.missingAt];
	const where =
		missing.via && root.kind !== "page"
			? `\`${missing.via.path}\``
			: missing.missingAt === 0
				? describeRoot(root, content)
				: `\`${formatPath(root, segments.slice(0, missing.missingAt))}\``;

	const { container } = missing;
	if (segment === "@content") {
		return `${where} has no body content`;
	}
	if (Array.isArray(container)) {
		return `${where} has ${container.length} item${container.length === 1 ? "" : "s"}, so there's no index ${String(segment)}`;
	}
	if (
		container === null ||
		(typeof container !== "object" && !(container instanceof FileValue))
	) {
		return `${where} is ${withArticle(container)}, not an object`;
	}
	return `${where} has no \`${String(segment)}\``;
};

const hintFor = (segments: Segment[], missing: Missing): string | undefined => {
	const segment = segments[missing.missingAt];
	if (Array.isArray(missing.container)) {
		return "The page renders more array items than the data has. Check that the template loops over this same array, and that the build is up to date.";
	}
	if (typeof segment !== "string") {
		return undefined;
	}
	const keys = availableKeys(missing.container);
	if (keys.length === 0) {
		return undefined;
	}
	const suggestion = closestKey(segment, keys);
	const listed = keys
		.slice(0, 12)
		.map((key) => `\`${key}\``)
		.join(", ");
	return `${suggestion ? `Did you mean \`${suggestion}\`? ` : ""}Available keys: ${listed}${keys.length > 12 ? ", …" : ""}`;
};

const isAncestor = (ancestor: RegionNode, node: RegionNode) => {
	for (let parent = node.parent; parent; parent = parent.parent) {
		if (parent === ancestor) {
			return true;
		}
	}
	return false;
};

export default defineRule({
	id: "prop-path-missing",
	severity: "error",
	phase: "data",
	regionTypes: [],
	description:
		"Every `data-prop` path must exist in the data it points at: the page's source file, or the collection, dataset or file it references.",
	rationale:
		"When a path isn't in the data, the runtime resolves it to `undefined` and the region never mounts. There's no error card: the region just isn't editable. Array items are checked by position, so an item rendered past the end of its array is reported too. For `@collections[…]`, CloudCannon's item order isn't known, so every file in the collection is checked.",
	sources: [
		"editable-regions/nodes/editable.ts:106-173,188-194",
		"editable-regions/nodes/editable-array.ts:62-99",
	],
	checkPage({ regions }, ctx) {
		const content = ctx.content;
		if (!content) {
			return;
		}
		// Report a missing key once, on the outermost region, not on every region nested under it.
		const reported = new Map<string, RegionNode[]>();

		for (const node of regions) {
			for (const binding of node.bindings) {
				const { resolved } = binding;
				// Empty segments are reported by prop-path-malformed.
				if (resolved.status !== "path" || resolved.segments.includes("")) {
					continue;
				}
				const missing = lookupBinding(content, binding).filter(
					(result): result is Missing => result.outcome === "missing",
				);
				if (missing.length === 0) {
					continue;
				}

				const [first] = missing;
				const key = formatPath(
					resolved.root,
					resolved.segments.slice(0, first.missingAt + 1),
				);
				const earlier = reported.get(key) ?? [];
				if (earlier.some((region) => isAncestor(region, node))) {
					continue;
				}
				reported.set(key, [...earlier, node]);

				report(node, binding, missing, content, ctx.report);
			}
		}
	},
});

const report = (
	node: RegionNode,
	binding: Binding,
	missing: Missing[],
	content: PageContent,
	send: RuleContext["report"],
) => {
	if (binding.resolved.status !== "path") {
		return;
	}
	const { root, segments } = binding.resolved;
	const [first] = missing;
	const path = formatPath(root, segments);
	const where = describeContainer(root, segments, first, content);

	const via = missing
		.map((result) => result.via)
		.filter((file): file is SourceFile => file !== undefined);
	let reason = `${describeBinding(node, binding)} points at \`${path}\`, but ${where}`;
	if (via.length > 1) {
		const total =
			root.kind === "collection"
				? content.site.collection(root.key)?.length
				: undefined;
		reason = `${describeBinding(node, binding)} points at \`${path}\`, which is missing in ${via.length}${total ? ` of ${total}` : ""} files: ${listFiles(via)}`;
	}
	send(node, reason, {
		attribute: binding.attribute,
		hint:
			hintFor(segments, first) ??
			(first.container instanceof FilesValue
				? undefined
				: "Add the field to the data, or fix the path."),
	});
};

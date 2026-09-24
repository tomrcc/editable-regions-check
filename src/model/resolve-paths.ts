import type { RegionNode } from "./region-tree.ts";
import { liveItems } from "./region-tree.ts";

/** Where a path starts: the page's own file, or an absolute `@collections`/`@data`/`@file` reference. */
export type PathRoot =
	| { kind: "page" }
	| { kind: "collection"; key: string }
	| { kind: "data"; key: string }
	| { kind: "file"; path: string };

/** A key, an array index, or "any file in this collection" (CloudCannon's order isn't known statically). */
export type Segment = string | number | { anyItem: true };

export type Resolution =
	| { status: "path"; root: PathRoot; segments: Segment[] }
	/** `@index`, `@length` or another `@name` read from special props rather than data. */
	| { status: "special"; name: string }
	/** Bound to a `data-literal-*` value. */
	| { status: "literal" }
	/** The runtime would resolve this to `undefined` whatever the data is. */
	| { status: "unbound"; reason: string }
	/** Can't be followed statically: template blueprints, snippets, parents that never hydrate. */
	| { status: "unresolvable"; reason: string };

export interface Binding {
	/** `undefined` for `data-prop`, otherwise the `data-prop-*` key as the runtime reads it. */
	key: string | undefined;
	/** The attribute to point diagnostics at. */
	attribute: string;
	/** The attribute's value as written (`""` for a synthesized array-item binding). */
	raw: string;
	resolved: Resolution;
}

export const SPECIAL_PROPS = {
	/** Provided by `EditableArray.getSpecialProps` (`editable-array.ts:541-550`). */
	"@length": "array",
	/** Provided by `EditableArrayItem.getSpecialProps` (`editable-array-item.ts:497-504`). */
	"@index": "array-item",
} as const;

const VALUE_REGION_TYPES = new Set(["text", "image", "source"]);

const ABSOLUTE_TYPES = ["collections", "data", "file"] as const;

/** Port of `Editable.matchSourcePart` (`editable.ts:684-705`). */
const matchSourcePart = (
	type: (typeof ABSOLUTE_TYPES)[number],
	source: string,
): { key: string; rest?: string } | undefined => {
	if (!source.startsWith(`@${type}`)) {
		return undefined;
	}
	const argsPart = source.slice(type.length + 1);
	const brackets = argsPart.match(/^\[+/);
	if (!brackets) {
		return undefined;
	}
	const n = brackets[0].length;
	const groups = argsPart.match(
		new RegExp(`^\\[{${n}}(?<key>.+?)\\]{${n}}(\\.(?<rest>.+))?$`),
	)?.groups;
	return groups ? { key: groups.key, rest: groups.rest } : undefined;
};

export interface ParsedSource {
	root: PathRoot;
	absolute: boolean;
	source: string;
	snippets: string[];
}

/** Port of `Editable.parseSource` (`editable.ts:707-763`), minus the API lookups. */
export const parseSource = (source: string): ParsedSource => {
	let root: PathRoot = { kind: "page" };
	let absolute = false;
	let rest: string | undefined = source;

	const collection = matchSourcePart("collections", source);
	const file = collection ? undefined : matchSourcePart("file", source);
	const data = collection || file ? undefined : matchSourcePart("data", source);
	if (collection) {
		root = { kind: "collection", key: collection.key };
	} else if (file) {
		root = { kind: "file", path: file.key };
	} else if (data) {
		root = { kind: "data", key: data.key };
	}
	const match = collection ?? file ?? data;
	if (match) {
		absolute = true;
		rest = match.rest;
	}

	const snippets: string[] = [];
	const snippetPattern = /@snippet\[(?<id>[^\]]+)\]\.(?<rest>.+)$/;
	let snippetMatch = rest?.match(snippetPattern);
	while (snippetMatch?.groups) {
		snippets.push(snippetMatch.groups.id);
		rest = snippetMatch.groups.rest;
		snippetMatch = rest.match(snippetPattern);
	}

	return { root, absolute, source: rest ?? "", snippets };
};

/** `lookupPathAndContext` treats an empty path as "the value itself" and otherwise splits on dots. */
const splitPath = (path: string): string[] => (path ? path.split(".") : []);

const unresolvable = (reason: string): Resolution => ({
	status: "unresolvable",
	reason,
});

/** Regions whose element the runtime never hydrates, so their children never receive a value. */
const neverHydrates = (region: RegionNode): string | undefined => {
	if (region.ignored) {
		return "its parent region has `data-cloudcannon-ignore`";
	}
	if (region.kind === "unknown") {
		return `its parent region type \`${region.type}\` isn't registered`;
	}
	return undefined;
};

const extend = (base: Resolution, segments: Segment[]): Resolution => {
	if (base.status === "path") {
		return { ...base, segments: [...base.segments, ...segments] };
	}
	if (base.status === "unbound") {
		return unresolvable("its parent region never receives a value");
	}
	if (base.status === "unresolvable") {
		return base;
	}
	return unresolvable(
		base.status === "special"
			? `its parent region is bound to \`${base.name}\``
			: "its parent region is bound to a literal value",
	);
};

/**
 * Statically resolves every `data-prop` and `data-prop-*` on the page to a
 * full path, the way the runtime would at hydration. The results are stored
 * on each region's `bindings`.
 *
 * The runtime passes values down the region tree: each region registers a
 * listener on its nearest parent region, and looks its path up in the
 * parent's value (`Editable.setupListeners`, `editable.ts:505-565`).
 */
export const resolvePaths = (regions: RegionNode[]): void => {
	const done = new Set<RegionNode>();

	/** The value a region hands to its children, looked up along `segments`. */
	const resolveInParent = (
		parent: RegionNode,
		segments: string[],
	): Resolution => {
		const blocked = neverHydrates(parent);
		if (blocked) {
			return unresolvable(blocked);
		}
		// Reported by value-region-has-children: the parent replaces its contents when edited.
		if (VALUE_REGION_TYPES.has(parent.type)) {
			return unresolvable(`its parent is a ${parent.type} region`);
		}
		resolve(parent);

		const base = parent.bindings.find((binding) => binding.key === undefined);

		// Arrays hand every child their item list, whatever its named props (`editable-array.ts:42-100`).
		if (parent.type === "array") {
			return base
				? extend(base.resolved, segments)
				: unresolvable("its parent array has no `data-prop`");
		}

		// A region's value is its base value with each named prop set on top (`getNewValue`, `editable.ts:239-310`).
		const [first, ...rest] = segments;
		if (first !== undefined) {
			if (parent.props.literal.some((prop) => prop.key === first)) {
				return { status: "literal" };
			}
			const named = parent.bindings.find((binding) => binding.key === first);
			if (named) {
				return extend(named.resolved, rest);
			}
		}

		if (base) {
			return extend(base.resolved, segments);
		}
		if (parent.props.literal.some((prop) => prop.key === "prop")) {
			return { status: "literal" };
		}
		if (first === undefined) {
			return unresolvable(
				"its parent region's value is built from named props",
			);
		}
		const hasNamed =
			parent.bindings.length > 0 || parent.props.literal.length > 0;
		return {
			status: "unbound",
			reason: hasNamed
				? `its parent region has no \`data-prop\` and no \`data-prop-${first}\``
				: "its parent region has no `data-prop` or `data-prop-*` attributes",
		};
	};

	const resolveBinding = (region: RegionNode, raw: string): Resolution => {
		const parsed = parseSource(raw);
		if (parsed.snippets.length > 0) {
			return unresolvable("paths inside snippets aren't checked");
		}
		const segments = splitPath(parsed.source);
		if (parsed.absolute) {
			return { status: "path", root: parsed.root, segments };
		}
		if (parsed.source.startsWith("@") && parsed.source !== "@content") {
			return { status: "special", name: parsed.source };
		}
		if (region.inTemplate) {
			return unresolvable("it's in a <template> blueprint");
		}
		if (region.parent) {
			return resolveInParent(region.parent, segments);
		}
		return { status: "path", root: { kind: "page" }, segments };
	};

	/** Array items take their index among the array's items as their path (`editable-array.ts:62-99,325`). */
	const resolveArrayItem = (item: RegionNode): Resolution => {
		const array = item.parent;
		if (array?.type !== "array") {
			return unresolvable("it isn't inside an array region");
		}
		if (item.inTemplate) {
			return unresolvable("it's in a <template> blueprint");
		}
		const blocked = neverHydrates(array);
		if (blocked) {
			return unresolvable(blocked);
		}
		resolve(array);
		const base = array.bindings.find((binding) => binding.key === undefined);
		if (!base) {
			// Reported by array-requires-prop.
			return unresolvable("its array has no `data-prop`");
		}
		const index = liveItems(array).indexOf(item);
		const segment: Segment =
			base.resolved.status === "path" &&
			base.resolved.root.kind === "collection" &&
			base.resolved.segments.length === 0
				? { anyItem: true }
				: index;
		return extend(base.resolved, [segment]);
	};

	const resolve = (region: RegionNode): void => {
		if (done.has(region)) {
			return;
		}
		done.add(region);

		const bindings: Binding[] = [];
		if (region.type === "array-item") {
			bindings.push({
				key: undefined,
				attribute: "data-prop",
				raw: region.props.base ?? "",
				resolved: resolveArrayItem(region),
			});
		} else if (region.props.base !== undefined) {
			bindings.push({
				key: undefined,
				attribute: "data-prop",
				raw: region.props.base,
				resolved: resolveBinding(region, region.props.base),
			});
		}
		for (const prop of region.props.named) {
			bindings.push({
				key: prop.key,
				attribute: prop.attribute,
				raw: prop.value,
				resolved: resolveBinding(region, prop.value),
			});
		}
		region.bindings = bindings;
	};

	regions.forEach(resolve);
};

const formatRoot = (root: PathRoot): string => {
	switch (root.kind) {
		case "page":
			return "";
		case "collection":
			return `@collections[${root.key}]`;
		case "data":
			return `@data[${root.key}]`;
		case "file":
			return `@file[${root.path}]`;
	}
};

const formatSegment = (segment: Segment): string =>
	typeof segment === "object" ? "*" : String(segment);

/**
 * The full path, as the runtime's error cards print it (`contextBase.fullPath`),
 * e.g. `hero.items.0.title` or `@data[nav].links.2`. Collection items print as `*`.
 */
export const formatPath = (root: PathRoot, segments: Segment[]): string =>
	[formatRoot(root), ...segments.map(formatSegment)]
		.filter((part, i) => i > 0 || part !== "")
		.join(".") || "(the whole file)";

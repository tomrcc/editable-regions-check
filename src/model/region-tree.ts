import type { Element, ElementContent, Root, RootContent } from "hast";
import type { Position } from "unist";
import { Attributes, openingTagPosition } from "./attributes.ts";
import {
	ATTRIBUTE_REGION_TYPES,
	DYNAMIC_REGION_TYPE,
	ELEMENT_PREFIX,
	ELEMENT_REGION_TYPES,
	IGNORE_ATTRIBUTE,
} from "./constants.ts";
import type { Binding } from "./resolve-paths.ts";

export type RegionKind = "builtin" | "custom" | "dynamic" | "unknown";

export interface NamedProp {
	/** The attribute as written, e.g. `data-prop-author-name`. */
	attribute: string;
	/** The key the runtime reads it as, e.g. `authorname`. See `editable.ts` `propName.substring(4).toLowerCase()`. */
	key: string;
	value: string;
}

export interface RegionNode {
	/** The region type: `data-editable`'s value, or the custom element's suffix. */
	type: string;
	kind: RegionKind;
	/** `attribute` for `data-editable="…"`, `element` for `<editable-…>`. */
	form: "attribute" | "element";
	tagName: string;
	element: Element;
	attributes: Attributes;
	/** Position of the opening tag. */
	position: Position | undefined;
	props: {
		/** `data-prop`, when present (may be `""`). */
		base: string | undefined;
		/** `data-prop-*` attributes. */
		named: NamedProp[];
		/** `data-literal-*` attributes. */
		literal: NamedProp[];
	};
	/** The nearest ancestor region, matching `Editable.setupListeners` in `editable.ts`. */
	parent: RegionNode | null;
	children: RegionNode[];
	/** Direct `<template>` children, which arrays use as blueprints for new items. */
	templates: Element[];
	/** True when a `<template>` sits between this region and its parent region. */
	viaTemplate: boolean;
	/** True when this region is anywhere inside `<template>` content. */
	inTemplate: boolean;
	/** `data-cloudcannon-ignore` on an attribute-form region: the runtime skips hydrating it. */
	ignored: boolean;
	/** Each `data-prop`/`data-prop-*` resolved to a full path. Filled in by `resolvePaths`. */
	bindings: Binding[];
}

export interface RegionTreeOptions {
	/** Extra `data-editable` types registered through `addCustomEditableRegion`. */
	customRegionTypes?: readonly string[];
}

const isElement = (node: RootContent | ElementContent): node is Element =>
	node.type === "element";

const classify = (
	element: Element,
	attributes: Attributes,
	customTypes: ReadonlySet<string>,
): Pick<RegionNode, "type" | "kind" | "form"> | null => {
	// The custom element form wins over `data-editable`, as in `getEditableType` (`helpers/checks.ts`).
	if (element.tagName.startsWith(ELEMENT_PREFIX)) {
		const type = element.tagName.slice(ELEMENT_PREFIX.length);
		const known = (ELEMENT_REGION_TYPES as readonly string[]).includes(type);
		return { type, kind: known ? "builtin" : "unknown", form: "element" };
	}

	const type = attributes.get("data-editable");
	if (type === undefined) {
		return null;
	}

	let kind: RegionKind = "unknown";
	if ((ATTRIBUTE_REGION_TYPES as readonly string[]).includes(type)) {
		kind = "builtin";
	} else if (type === DYNAMIC_REGION_TYPE) {
		kind = "dynamic";
	} else if (customTypes.has(type)) {
		kind = "custom";
	}
	return { type, kind, form: "attribute" };
};

const readProps = (attributes: Attributes): RegionNode["props"] => {
	const props: RegionNode["props"] = {
		base: attributes.get("data-prop"),
		named: [],
		literal: [],
	};

	for (const { name, value } of attributes) {
		if (name.startsWith("data-prop-")) {
			const suffix = name.slice("data-prop-".length);
			props.named.push({
				attribute: name,
				key: suffix.replaceAll("-", ""),
				value,
			});
		} else if (name.startsWith("data-literal-")) {
			const suffix = name.slice("data-literal-".length);
			props.literal.push({
				attribute: name,
				key: suffix.replaceAll("-", ""),
				value,
			});
		}
	}

	return props;
};

/**
 * Build the tree of editable regions on a page. Non-region elements are
 * flattened away: each region's `parent` is its nearest region ancestor.
 *
 * `<template>` content is only walked when the template is a direct child of
 * an array region, because that is the only place the runtime uses it (as a
 * blueprint for new items). Other templates are inert as far as editable
 * regions are concerned.
 */
export const buildRegionTree = (
	tree: Root,
	options: RegionTreeOptions = {},
): RegionNode[] => {
	const customTypes = new Set(options.customRegionTypes ?? []);
	const roots: RegionNode[] = [];

	const walk = (
		nodes: (RootContent | ElementContent)[],
		parent: RegionNode | null,
		inTemplate: boolean,
		viaTemplate: boolean,
	): void => {
		for (const node of nodes) {
			if (!isElement(node)) {
				continue;
			}

			if (node.tagName === "template") {
				if (
					parent?.type === "array" &&
					parent.element.children.includes(node)
				) {
					if (!new Attributes(node).has(IGNORE_ATTRIBUTE)) {
						parent.templates.push(node);
						walk(node.content?.children ?? [], parent, true, true);
					}
				}
				continue;
			}

			const attributes = new Attributes(node);
			const classification = classify(node, attributes, customTypes);

			if (!classification) {
				walk(node.children, parent, inTemplate, viaTemplate);
				continue;
			}

			const region: RegionNode = {
				...classification,
				tagName: node.tagName,
				element: node,
				attributes,
				position: openingTagPosition(node),
				props: readProps(attributes),
				parent,
				children: [],
				templates: [],
				viaTemplate,
				inTemplate,
				ignored:
					classification.form === "attribute" &&
					attributes.has(IGNORE_ATTRIBUTE),
				bindings: [],
			};

			(parent ? parent.children : roots).push(region);
			walk(node.children, region, inTemplate, false);
		}
	};

	walk(tree.children, null, false, false);
	return roots;
};

/** Depth-first list of every region in the tree. */
export const flattenRegions = (roots: RegionNode[]): RegionNode[] => {
	const all: RegionNode[] = [];
	const visit = (node: RegionNode) => {
		all.push(node);
		node.children.forEach(visit);
	};
	roots.forEach(visit);
	return all;
};

/** Array items that are live on the page, excluding template blueprints. */
export const liveItems = (array: RegionNode): RegionNode[] =>
	array.children.filter(
		(child) => child.type === "array-item" && !child.viaTemplate,
	);

/** Depth-first search of an element's descendants (not `<template>` content), like `querySelector`. */
export const findDescendant = (
	element: Element,
	predicate: (element: Element) => boolean,
): Element | undefined => {
	for (const child of element.children) {
		if (!isElement(child)) {
			continue;
		}
		if (predicate(child)) {
			return child;
		}
		const found = findDescendant(child, predicate);
		if (found) {
			return found;
		}
	}
	return undefined;
};

export const elementChildren = (element: Element): Element[] =>
	element.children.filter(isElement);

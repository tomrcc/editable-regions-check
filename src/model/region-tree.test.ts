import { VFile } from "vfile";
import { describe, expect, it } from "vitest";
import { parse } from "../parse.ts";
import { buildRegionTree, flattenRegions, liveItems } from "./region-tree.ts";

const tree = (html: string, customRegionTypes?: string[]) =>
	buildRegionTree(parse(new VFile(html)), { customRegionTypes });

describe("buildRegionTree", () => {
	it("links regions to their nearest region ancestor, skipping plain elements", () => {
		const [array] = tree(`
			<div data-editable="array" data-prop="items">
				<div class="wrap"><editable-array-item><h2 data-editable="text" data-prop="t"></h2></editable-array-item></div>
			</div>`);
		expect(array.type).toBe("array");
		const [item] = array.children;
		expect(item).toMatchObject({
			type: "array-item",
			form: "element",
			parent: array,
		});
		expect(item.children[0]).toMatchObject({
			type: "text",
			form: "attribute",
			parent: item,
		});
	});

	it("walks direct <template> children of arrays as blueprints", () => {
		const [array] = tree(`
			<ul data-editable="array" data-prop="items">
				<li data-editable="array-item"></li>
				<template><li data-editable="array-item"><span data-editable="text" data-prop="t"></span></li></template>
			</ul>
			<template><div data-editable="array-item"></div></template>`);
		expect(array.templates).toHaveLength(1);
		expect(liveItems(array)).toHaveLength(1);
		const blueprint = array.children[1];
		expect(blueprint).toMatchObject({ viaTemplate: true, inTemplate: true });
		expect(blueprint.children[0]).toMatchObject({
			viaTemplate: false,
			inTemplate: true,
		});
		// The stray template outside the array is inert.
		expect(flattenRegions([array])).toHaveLength(4);
	});

	it("classifies region kinds", () => {
		const kinds = tree(
			`
			<div data-editable="text" data-prop="a"></div>
			<div data-editable="_dynamic" data-prop=""></div>
			<div data-editable="map" data-prop="b"></div>
			<div data-editable="chart" data-prop="c"></div>
			<editable-thing></editable-thing>`,
			["map"],
		).map((r) => r.kind);
		expect(kinds).toEqual([
			"builtin",
			"dynamic",
			"custom",
			"unknown",
			"unknown",
		]);
	});

	it("marks attribute-form regions with data-cloudcannon-ignore", () => {
		const [ignored, element] = tree(`
			<div data-editable="text" data-cloudcannon-ignore></div>
			<editable-text data-prop="a" data-cloudcannon-ignore></editable-text>`);
		expect(ignored.ignored).toBe(true);
		// The runtime doesn't check the attribute on web components.
		expect(element.ignored).toBe(false);
	});

	it("reads props with the keys the runtime uses", () => {
		const [region] = tree(
			`<editable-component data-component="x" data-prop="base" data-prop-authorName="a" data-literal-show-bio="true"></editable-component>`,
		);
		expect(region.props).toEqual({
			base: "base",
			named: [
				{ attribute: "data-prop-authorname", key: "authorname", value: "a" },
			],
			literal: [
				{ attribute: "data-literal-show-bio", key: "showbio", value: "true" },
			],
		});
	});
});

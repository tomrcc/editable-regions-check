import { VFile } from "vfile";
import { describe, expect, it } from "vitest";
import { parse } from "../parse.ts";
import { buildRegionTree, flattenRegions } from "./region-tree.ts";
import { formatPath, parseSource, resolvePaths } from "./resolve-paths.ts";

/** Every binding on the page as `attribute=value → resolution`, in document order. */
const resolve = (html: string, customRegionTypes?: string[]) => {
	const regions = flattenRegions(
		buildRegionTree(parse(new VFile(html)), { customRegionTypes }),
	);
	resolvePaths(regions);
	return regions.flatMap((region) =>
		region.bindings.map(({ attribute, raw, resolved }) => {
			const described =
				resolved.status === "path"
					? formatPath(resolved.root, resolved.segments)
					: resolved.status === "special"
						? `special ${resolved.name}`
						: resolved.status === "literal"
							? "literal"
							: `${resolved.status}: ${resolved.reason}`;
			return `${region.type} ${attribute}="${raw}" → ${described}`;
		}),
	);
};

describe("parseSource", () => {
	it.each([
		["title", "page", "title"],
		["@collections[blog]", "collection blog", ""],
		["@collections[blog].0.title", "collection blog", "0.title"],
		["@data[nav].links", "data nav", "links"],
		[
			"@file[/content/about.md].seo.title",
			"file /content/about.md",
			"seo.title",
		],
		["@file[[a[1].md]].x", "file a[1].md", "x"],
		["@collections[blog", "page", "@collections[blog"],
		["@snippet[abc].title", "page", "title"],
	])("%s", (raw, root, source) => {
		const parsed = parseSource(raw);
		const described =
			parsed.root.kind === "page"
				? "page"
				: `${parsed.root.kind} ${"key" in parsed.root ? parsed.root.key : parsed.root.path}`;
		expect([described, parsed.source]).toEqual([root, source]);
	});
});

describe("resolvePaths", () => {
	it("resolves top-level and nested component paths", () => {
		expect(
			resolve(`
				<h1 data-editable="text" data-prop="title"></h1>
				<section data-editable="component" data-component="hero" data-prop="hero">
					<p data-editable="text" data-prop="heading.text"></p>
					<div data-editable="component" data-component="cta" data-prop="cta">
						<a data-editable="text" data-prop="label"></a>
					</div>
				</section>`),
		).toEqual([
			'text data-prop="title" → title',
			'component data-prop="hero" → hero',
			'text data-prop="heading.text" → hero.heading.text',
			'component data-prop="cta" → hero.cta',
			'text data-prop="label" → hero.cta.label',
		]);
	});

	it("passes an empty data-prop through to the parent's value", () => {
		expect(
			resolve(`
				<div data-editable="component" data-component="c" data-prop="card">
					<div data-editable="component" data-component="inner" data-prop="">
						<span data-editable="text" data-prop="title"></span>
					</div>
				</div>`),
		).toEqual([
			'component data-prop="card" → card',
			'component data-prop="" → card',
			'text data-prop="title" → card.title',
		]);
	});

	it("gives array items their index, ignoring their own data-prop", () => {
		expect(
			resolve(`
				<ul data-editable="array" data-prop="features">
					<li data-editable="array-item" data-prop="7"><span data-editable="text" data-prop="title"></span></li>
					<li data-editable="array-item"><span data-editable="text" data-prop="title"></span></li>
					<template><li data-editable="array-item"><span data-editable="text" data-prop="title"></span></li></template>
				</ul>`),
		).toEqual([
			'array data-prop="features" → features',
			'array-item data-prop="7" → features.0',
			'text data-prop="title" → features.0.title',
			'array-item data-prop="" → features.1',
			'text data-prop="title" → features.1.title',
			'array-item data-prop="" → unresolvable: it\'s in a <template> blueprint',
			'text data-prop="title" → unresolvable: it\'s in a <template> blueprint',
		]);
	});

	it("resolves arrays nested in array items", () => {
		expect(
			resolve(`
				<div data-editable="array" data-prop="sections">
					<div data-editable="array-item"></div>
					<div data-editable="array-item">
						<ul data-editable="array" data-prop="links">
							<li data-editable="array-item"><a data-editable="text" data-prop=""></a></li>
						</ul>
					</div>
				</div>`),
		).toEqual([
			'array data-prop="sections" → sections',
			'array-item data-prop="" → sections.0',
			'array-item data-prop="" → sections.1',
			'array data-prop="links" → sections.1.links',
			'array-item data-prop="" → sections.1.links.0',
			'text data-prop="" → sections.1.links.0',
		]);
	});

	it("marks collection items as any item, and absolute paths skip the parent", () => {
		expect(
			resolve(`
				<div data-editable="component" data-component="c" data-prop="ignored">
					<ul data-editable="array" data-prop="@collections[blog]">
						<li data-editable="array-item"><h2 data-editable="text" data-prop="title"></h2></li>
					</ul>
					<nav data-editable="array" data-prop="@data[nav].links"></nav>
				</div>`),
		).toEqual([
			'component data-prop="ignored" → ignored',
			'array data-prop="@collections[blog]" → @collections[blog]',
			'array-item data-prop="" → @collections[blog].*',
			'text data-prop="title" → @collections[blog].*.title',
			'array data-prop="@data[nav].links" → @data[nav].links',
		]);
	});

	it("follows named props on the parent before its base value", () => {
		expect(
			resolve(`
				<div data-editable="component" data-component="c" data-prop="card" data-prop-author="authors.0" data-literal-size="2">
					<span data-editable="text" data-prop="author.name"></span>
					<span data-editable="text" data-prop="title"></span>
					<span data-editable="text" data-prop="size"></span>
				</div>
				<div data-editable="component" data-component="c" data-prop-image="hero_image">
					<span data-editable="text" data-prop="image.alt"></span>
					<span data-editable="text" data-prop="title"></span>
				</div>`),
		).toEqual([
			'component data-prop="card" → card',
			'component data-prop-author="authors.0" → authors.0',
			'text data-prop="author.name" → authors.0.name',
			'text data-prop="title" → card.title',
			'text data-prop="size" → literal',
			'component data-prop-image="hero_image" → hero_image',
			'text data-prop="image.alt" → hero_image.alt',
			'text data-prop="title" → unbound: its parent region has no `data-prop` and no `data-prop-title`',
		]);
	});

	it("reports specials, @content, snippets and parents that never hydrate", () => {
		expect(
			resolve(`
				<div data-editable="text" data-prop="@content"></div>
				<ul data-editable="array" data-prop="items">
					<li data-editable="array-item"><span data-editable="text" data-prop="@index"></span></li>
				</ul>
				<div data-editable="text" data-prop="@snippet[a1].title"></div>
				<div data-editable="chart" data-prop="c"><span data-editable="text" data-prop="x"></span></div>
				<div data-editable="component" data-component="c" data-cloudcannon-ignore data-prop="c"><span data-editable="text" data-prop="x"></span></div>
				<div data-editable="component" data-component="c"><span data-editable="text" data-prop="x"></span></div>`),
		).toEqual([
			'text data-prop="@content" → @content',
			'array data-prop="items" → items',
			'array-item data-prop="" → items.0',
			'text data-prop="@index" → special @index',
			'text data-prop="@snippet[a1].title" → unresolvable: paths inside snippets aren\'t checked',
			'chart data-prop="c" → c',
			'text data-prop="x" → unresolvable: its parent region type `chart` isn\'t registered',
			'component data-prop="c" → c',
			'text data-prop="x" → unresolvable: its parent region has `data-cloudcannon-ignore`',
			'text data-prop="x" → unbound: its parent region has no `data-prop` or `data-prop-*` attributes',
		]);
	});

	it("treats registered custom region types like any other region", () => {
		expect(
			resolve(
				`<div data-editable="chart" data-prop="c"><span data-editable="text" data-prop="x"></span></div>`,
				["chart"],
			),
		).toEqual(['chart data-prop="c" → c', 'text data-prop="x" → c.x']);
	});
});

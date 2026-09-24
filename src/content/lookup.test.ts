import { describe, expect, it } from "vitest";
import { FilesValue, lookup, type PageContent } from "./lookup.ts";
import type { SiteIndex, SourceFile } from "./site-index.ts";

const post = (path: string, data: unknown): SourceFile => ({
	path,
	data,
	content: "Body",
});
const posts = [
	post("blog/a.md", { title: "A" }),
	post("blog/b.md", { title: "B", tags: ["x"] }),
];
const page = post("about.md", {
	hero: { title: "Hi" },
	items: ["one"],
	empty: null,
});

const site: SiteIndex = {
	configPath: "cloudcannon.config.yml",
	sourceDir: ".",
	config: { data_config: { gone: { path: "gone.json" } } },
	warnings: [],
	pageFor: () => undefined,
	collection: (key) => (key === "blog" ? posts : undefined),
	dataset: (key) =>
		key === "nav"
			? post("nav.json", { links: [{ label: "Home" }] })
			: undefined,
	file: (path) => (path === "blog/a.md" ? posts[0] : undefined),
};
const content: PageContent = { site, file: page };

const outcomes = (...args: Parameters<typeof lookup>) =>
	lookup(...args).map((result) =>
		result.outcome === "found"
			? `found ${JSON.stringify(result.value instanceof FilesValue ? "files" : result.value)}${result.via ? ` via ${result.via.path}` : ""}`
			: result.outcome === "missing"
				? `missing at ${result.missingAt}${result.via ? ` via ${result.via.path}` : ""}`
				: result.outcome === "no-target"
					? `no-target: ${result.message}`
					: result.outcome,
	);

describe("lookup", () => {
	it("walks the page's frontmatter and body", () => {
		expect(outcomes(content, { kind: "page" }, ["hero", "title"])).toEqual([
			'found "Hi"',
		]);
		expect(outcomes(content, { kind: "page" }, ["items", 0])).toEqual([
			'found "one"',
		]);
		expect(outcomes(content, { kind: "page" }, ["empty"])).toEqual([
			"found null",
		]);
		expect(outcomes(content, { kind: "page" }, ["@content"])).toEqual([
			'found "Body"',
		]);
		expect(outcomes(content, { kind: "page" }, ["hero", "nope", "x"])).toEqual([
			"missing at 1",
		]);
		expect(outcomes(content, { kind: "page" }, ["items", 1])).toEqual([
			"missing at 1",
		]);
	});

	it("skips page paths when the page has no source file", () => {
		expect(
			outcomes({ site, file: undefined }, { kind: "page" }, ["x"]),
		).toEqual(["skipped"]);
	});

	it("checks every file for a collection item", () => {
		const root = { kind: "collection", key: "blog" } as const;
		expect(outcomes(content, root, [])).toEqual(['found "files"']);
		expect(outcomes(content, root, [{ anyItem: true }, "tags"])).toEqual([
			"missing at 1 via blog/a.md",
			'found ["x"] via blog/b.md',
		]);
	});

	it("reads datasets and other files", () => {
		expect(
			outcomes(content, { kind: "data", key: "nav" }, ["links", "0", "label"]),
		).toEqual(['found "Home"']);
		expect(
			outcomes(content, { kind: "file", path: "blog/a.md" }, ["title"]),
		).toEqual(['found "A"']);
	});

	it("reports references to things that don't exist", () => {
		expect(outcomes(content, { kind: "collection", key: "news" }, [])).toEqual([
			"no-target: `@collections[news]`: there's no `news` in `collections_config`",
		]);
		expect(outcomes(content, { kind: "data", key: "gone" }, [])).toEqual([
			"no-target: `@data[gone]`: its `data_config` path `gone.json` doesn't exist",
		]);
		expect(outcomes(content, { kind: "file", path: "x.md" }, [])).toEqual([
			"no-target: `@file[x.md]`: there's no file at `x.md` in the site source",
		]);
	});
});

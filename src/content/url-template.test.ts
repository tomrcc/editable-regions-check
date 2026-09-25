import { describe, expect, it } from "vitest";
import {
	evaluateUrlTemplate,
	UnsupportedTemplateError,
} from "./url-template.ts";

const file = (path: string, relativePath: string, data: unknown = {}) => ({
	path,
	relativePath,
	collection: "blog",
	data,
});

describe("evaluateUrlTemplate", () => {
	it.each([
		["/[slug]/", "content/pages/about.md", "about.md", "/about/"],
		["/[slug]/", "content/pages/index.md", "index.md", "/"],
		["/[full_slug]/", "pages/index.md", "index.md", "/"],
		["/[full_slug]/", "content/_index.md", "_index.md", "/"],
		[
			"/[full_slug]/",
			"content/privacy/_index.md",
			"privacy/_index.md",
			"/privacy/",
		],
		[
			"/[full_slug]/",
			"pages/contact/index.md",
			"contact/index.md",
			"/contact/",
		],
		["/[full_slug]/", "pages/docs/intro.md", "docs/intro.md", "/docs/intro/"],
		[
			"/[relative_base_path]/",
			"pages/docs/intro.md",
			"docs/intro.md",
			"/docs/intro/",
		],
		["/[collection]/[filename]", "blog/a.md", "a.md", "/blog/a.md"],
		["/files/[base_path].[ext]", "blog/a.md", "a.md", "/files/blog/a.md"],
		["/[path]", "blog/a.md", "a.md", "/blog/a.md"],
		["/[relative_path]", "blog/x/a.md", "x/a.md", "/x/a.md"],
		[
			"/[slug|strip_leading_date]/",
			"blog/2024-01-02-hello.md",
			"2024-01-02-hello.md",
			"/hello/",
		],
	])("%s for %s", (template, path, relativePath, expected) => {
		expect(evaluateUrlTemplate(template, file(path, relativePath))).toBe(
			expected,
		);
	});

	it("reads data placeholders with filters", () => {
		const data = {
			title: "Héllo, Wörld!",
			date: "2024-03-09",
			seo: { slug: "Custom" },
			tags: ["a", "b"],
		};
		const f = file("blog/x.md", "x.md", data);
		expect(
			evaluateUrlTemplate("/blog/{title|deburr|slugify|lowercase}/", f),
		).toBe("/blog/hello-world/");
		expect(
			evaluateUrlTemplate("/{date|year}/{date|month}/{date|day}/", f),
		).toBe("/2024/03/09/");
		expect(evaluateUrlTemplate("/{seo.slug|uppercase}/", f)).toBe("/CUSTOM/");
		expect(evaluateUrlTemplate("/{tags[*]}/", f)).toBe("/a, b/");
		expect(evaluateUrlTemplate("/{missing|default=none}/", f)).toBe("/none/");
		expect(
			evaluateUrlTemplate("/{permalink}[full_slug|unless=permalink]/", f),
		).toBe("/x/");
	});

	it("throws on placeholders and filters it doesn't know", () => {
		expect(() => evaluateUrlTemplate("/[nope]/", file("a.md", "a.md"))).toThrow(
			UnsupportedTemplateError,
		);
		expect(() =>
			evaluateUrlTemplate("/[slug|nope]/", file("a.md", "a.md")),
		).toThrow(UnsupportedTemplateError);
	});
});

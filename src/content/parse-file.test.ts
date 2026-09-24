import { describe, expect, it } from "vitest";
import { parseFile } from "./parse-file.ts";

describe("parseFile", () => {
	it("splits YAML frontmatter from the body", () => {
		expect(
			parseFile("a.md", "---\ntitle: Hi\ndate: 2024-01-01\n---\nBody\n"),
		).toEqual({
			data: { title: "Hi", date: "2024-01-01" },
			content: "Body\n",
		});
	});

	it("reads TOML and JSON frontmatter, with TOML dates as strings", () => {
		expect(
			parseFile("a.md", "+++\ntitle = 'Hi'\ndate = 2024-01-01\n+++\nBody"),
		).toEqual({
			data: { title: "Hi", date: "2024-01-01" },
			content: "Body",
		});
		expect(parseFile("a.md", ';;;\n{"title": "Hi"}\n;;;\n')).toEqual({
			data: { title: "Hi" },
			content: "",
		});
	});

	it("treats empty or missing frontmatter as no data", () => {
		expect(parseFile("a.md", "---\n---\nBody")).toEqual({
			data: {},
			content: "Body",
		});
		expect(parseFile("a.html", "<p>Hi</p>")).toEqual({
			data: {},
			content: "<p>Hi</p>",
		});
	});

	it("parses data files whole", () => {
		expect(parseFile("nav.json", '{"links": []}')).toEqual({
			data: { links: [] },
			content: undefined,
		});
		expect(parseFile("nav.yml", "- a\n- b")).toEqual({
			data: ["a", "b"],
			content: undefined,
		});
	});

	it("throws on invalid syntax", () => {
		expect(() => parseFile("a.md", "---\ntitle: [\n---\n")).toThrow();
	});
});

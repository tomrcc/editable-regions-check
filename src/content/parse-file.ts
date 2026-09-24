import { extname } from "node:path";
import { parse as parseToml, TomlDate } from "smol-toml";
import { parse as parseYaml } from "yaml";

export interface ParsedFile {
	/** Frontmatter (`{}` when there is none), or the whole file for data files. */
	data: unknown;
	/** The body after the frontmatter. `undefined` for data files. */
	content: string | undefined;
}

const DATA_EXTENSIONS = new Set([".yml", ".yaml", ".json", ".toml"]);

/** TOML dates parse to objects, but CloudCannon hands them to the page as strings. */
const plainToml = (value: unknown): unknown => {
	if (value instanceof TomlDate) {
		return value.toISOString();
	}
	if (Array.isArray(value)) {
		return value.map(plainToml);
	}
	if (value && typeof value === "object") {
		return Object.fromEntries(
			Object.entries(value).map(([key, inner]) => [key, plainToml(inner)]),
		);
	}
	return value;
};

const parseData = (text: string, format: "yaml" | "json" | "toml"): unknown => {
	switch (format) {
		case "yaml":
			return parseYaml(text);
		case "json":
			return JSON.parse(text);
		case "toml":
			return plainToml(parseToml(text));
	}
};

const FRONTMATTER = [
	{
		pattern: /^---[ \t]*\r?\n([\s\S]*?)\r?\n?^---[ \t]*(?:\r?\n|$)/m,
		format: "yaml",
	},
	{
		pattern: /^\+\+\+[ \t]*\r?\n([\s\S]*?)\r?\n?^\+\+\+[ \t]*(?:\r?\n|$)/m,
		format: "toml",
	},
	{
		pattern: /^;;;[ \t]*\r?\n([\s\S]*?)\r?\n?^;;;[ \t]*(?:\r?\n|$)/m,
		format: "json",
	},
] as const;

/**
 * Reads a source file the way CloudCannon's editors see it: data files are
 * parsed whole, anything else is split into frontmatter (YAML `---`, TOML
 * `+++` or JSON `;;;`) and body. Throws on invalid syntax.
 */
export const parseFile = (path: string, text: string): ParsedFile => {
	const ext = extname(path).toLowerCase();
	if (DATA_EXTENSIONS.has(ext)) {
		const format = ext === ".json" ? "json" : ext === ".toml" ? "toml" : "yaml";
		return { data: parseData(text, format), content: undefined };
	}

	const body = text.replace(/^﻿/, "");
	for (const { pattern, format } of FRONTMATTER) {
		const match = body.match(pattern);
		if (match && match.index === 0) {
			return {
				data: parseData(match[1], format) ?? {},
				content: body.slice(match[0].length),
			};
		}
	}
	return { data: {}, content: body };
};

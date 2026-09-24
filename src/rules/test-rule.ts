import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { checkHtml } from "../check.ts";
import type { PageContent } from "../content/lookup.ts";
import { parseFile } from "../content/parse-file.ts";
import { buildSiteIndex, type SiteIndex } from "../content/site-index.ts";
import type { Rule } from "./define-rule.ts";

const EXPECT_COMMENT = /<!--\s*expect:\s*(\d+)\s*-->/;

const fixtures = (dir: string) =>
	readdirSync(dir)
		.filter((name) => name.endsWith(".html"))
		.map((name) => ({ name, html: readFileSync(join(dir, name), "utf8") }));

/**
 * `data` rules check each fixture against its sibling `.md` file (the page's
 * source file), and against the rule's `source/` project for `@collections`,
 * `@data` and `@file` paths.
 */
const pageContent = (
	site: SiteIndex,
	dir: string,
	name: string,
): PageContent => {
	const path = join(dir, name.replace(/\.html$/, ".md"));
	return {
		site,
		file: existsSync(path)
			? {
					path: name.replace(/\.html$/, ".md"),
					...parseFile(path, readFileSync(path, "utf8")),
				}
			: undefined,
	};
};

const run = (rule: Rule, html: string, content?: PageContent) =>
	checkHtml(html, { rules: [rule], content }).messages.map(
		(message) =>
			`${message.line}:${message.column} ${message.fatal ? "error" : "warn"} ${message.reason}${message.note ? `\n  hint: ${message.note}` : ""}`,
	);

/**
 * Runs a rule against the fixtures next to it:
 * - `valid/*.html` must produce no diagnostics.
 * - `invalid/*.html` must produce one diagnostic, or the count in an
 *   `<!-- expect: N -->` comment. The output is snapshotted, so changes to
 *   messages or positions show up in review.
 */
export const testRule = (rule: Rule, dir: string) => {
	describe(rule.id, async () => {
		const site =
			rule.phase === "data"
				? await buildSiteIndex({
						projectDir: join(dir, "source"),
						outputPages: [],
					})
				: undefined;
		const content = (fixtureDir: string, name: string) =>
			site ? pageContent(site, fixtureDir, name) : undefined;

		for (const { name, html } of fixtures(join(dir, "valid"))) {
			it(`valid/${name}`, () => {
				expect(run(rule, html, content(join(dir, "valid"), name))).toEqual([]);
			});
		}

		for (const { name, html } of fixtures(join(dir, "invalid"))) {
			it(`invalid/${name}`, () => {
				const expected = Number(html.match(EXPECT_COMMENT)?.[1] ?? 1);
				const messages = run(rule, html, content(join(dir, "invalid"), name));
				expect(messages).toHaveLength(expected);
				expect(messages).toMatchSnapshot();
			});
		}
	});
};

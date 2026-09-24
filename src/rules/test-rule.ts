import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { checkHtml } from "../check.ts";
import type { Rule } from "./define-rule.ts";

const EXPECT_COMMENT = /<!--\s*expect:\s*(\d+)\s*-->/;

const fixtures = (dir: string) =>
	readdirSync(dir)
		.filter((name) => name.endsWith(".html"))
		.map((name) => ({ name, html: readFileSync(join(dir, name), "utf8") }));

const run = (rule: Rule, html: string) =>
	checkHtml(html, { rules: [rule] }).messages.map(
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
	describe(rule.id, () => {
		for (const { name, html } of fixtures(join(dir, "valid"))) {
			it(`valid/${name}`, () => {
				expect(run(rule, html)).toEqual([]);
			});
		}

		for (const { name, html } of fixtures(join(dir, "invalid"))) {
			it(`invalid/${name}`, () => {
				const expected = Number(html.match(EXPECT_COMMENT)?.[1] ?? 1);
				const messages = run(rule, html);
				expect(messages).toHaveLength(expected);
				expect(messages).toMatchSnapshot();
			});
		}
	});
};

import { existsSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { rules } from "./index.ts";

const rulesDir = import.meta.dirname;
const folders = readdirSync(rulesDir).filter((name) =>
	statSync(join(rulesDir, name)).isDirectory(),
);

const htmlCount = (dir: string) =>
	existsSync(dir)
		? readdirSync(dir).filter((name) => name.endsWith(".html")).length
		: 0;

describe("rule registry", () => {
	it("has unique ids", () => {
		const ids = rules.map((rule) => rule.id);
		expect(new Set(ids).size).toBe(ids.length);
	});

	it("lists every rule folder in rules/index.ts", () => {
		expect(rules.map((rule) => rule.id).sort()).toEqual(folders.sort());
	});

	for (const rule of rules) {
		describe(rule.id, () => {
			it("has a check or checkPage function", () => {
				expect(rule.check ?? rule.checkPage).toBeTypeOf("function");
			});

			it("has valid and invalid fixtures and a test file", () => {
				const dir = join(rulesDir, rule.id);
				expect(htmlCount(join(dir, "valid"))).toBeGreaterThan(0);
				expect(htmlCount(join(dir, "invalid"))).toBeGreaterThan(0);
				expect(existsSync(join(dir, "rule.test.ts"))).toBe(true);
			});

			it("documents its sources", () => {
				expect(rule.sources.length).toBeGreaterThan(0);
			});
		});
	}
});

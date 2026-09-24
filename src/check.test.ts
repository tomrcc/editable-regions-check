import { relative } from "node:path";
import { describe, expect, it } from "vitest";
import { checkSite } from "./check.ts";
import { rules } from "./rules/index.ts";

const dir = `${import.meta.dirname}/fixtures/broken-site`;

describe("checkSite", () => {
	it("reports each rule exactly once across the seeded broken site", async () => {
		const files = await checkSite({ dir });
		const messages = files.flatMap((file) =>
			file.messages.map(
				(message) =>
					`${relative(dir, file.path)}:${message.line}:${message.column} ${message.ruleId}`,
			),
		);

		const ruleIds = messages.map((message) => message.split(" ")[1]).sort();
		expect(ruleIds).toEqual(rules.map((rule) => rule.id).sort());
		expect(messages).toMatchSnapshot();
	});

	it("applies config severity overrides and ignores", async () => {
		const files = await checkSite({
			dir,
			config: {
				rules: { "unknown-region-type": "off", "text-requires-prop": "warn" },
				ignore: ["blog/**"],
			},
		});
		expect(files).toHaveLength(1);
		const [file] = files;
		expect(file.messages.some((m) => m.ruleId === "unknown-region-type")).toBe(
			false,
		);
		expect(
			file.messages.find((m) => m.ruleId === "text-requires-prop")?.fatal,
		).toBe(false);
	});
});

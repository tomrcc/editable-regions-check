import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { ATTRIBUTE_REGION_TYPES, ELEMENT_REGION_TYPES } from "./constants.ts";

/**
 * Compares our mirrored constants against the runtime in the sibling
 * `editable-regions` checkout. When the runtime adds or removes a region
 * type, this fails: update `constants.ts`, then recheck the rules whose
 * `sources` point at the changed files.
 */
const runtime = join(import.meta.dirname, "../../../editable-regions");

describe.skipIf(!existsSync(runtime))("runtime drift", () => {
	it("attribute region types match baseEditableMap", () => {
		const source = readFileSync(
			join(runtime, "helpers/hydrate-editable-regions.ts"),
			"utf8",
		);
		const body = source.match(/const baseEditableMap[^{]*\{([^}]*)\}/)?.[1];
		const keys = [...(body ?? "").matchAll(/"?([\w-]+)"?\s*:/g)].map(
			(match) => match[1],
		);
		expect(keys.sort()).toEqual([...ATTRIBUTE_REGION_TYPES].sort());
	});

	it("element region types match the web components", () => {
		const types = readdirSync(join(runtime, "components"))
			.map((name) => name.match(/^editable-(.+)-component\.ts$/)?.[1])
			.filter((type) => type !== undefined);
		expect(types.sort()).toEqual([...ELEMENT_REGION_TYPES].sort());
	});
});

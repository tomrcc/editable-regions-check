import { readFile } from "node:fs/promises";
import type { Severity } from "./rules/define-rule.ts";

export type RuleSetting = Severity | "off";

export interface Config {
	/** Override a rule's default severity, or turn it `"off"`. Keyed by rule id. */
	rules?: Record<string, RuleSetting>;
	/** `data-editable` types registered with `addCustomEditableRegion`. */
	customRegionTypes?: string[];
	/** Globs (relative to the checked directory) to skip. */
	ignore?: string[];
}

export const loadConfig = async (path: string): Promise<Config> =>
	JSON.parse(await readFile(path, "utf8")) as Config;

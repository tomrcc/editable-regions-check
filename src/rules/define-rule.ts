import type { RegionNode } from "../model/region-tree.ts";

export type Severity = "error" | "warn";

export interface ReportOptions {
	/** Extra guidance printed under the message. */
	hint?: string;
	/** Point at this attribute instead of the whole opening tag. */
	attribute?: string;
}

export interface RuleContext {
	report(node: RegionNode, message: string, options?: ReportOptions): void;
}

export interface Page {
	/** Every region on the page, depth first. Ignored regions are excluded. */
	regions: RegionNode[];
}

export interface Rule {
	/** Kebab-case id, matching the rule's folder name. */
	id: string;
	/** Default severity. Config can override it or turn the rule off. */
	severity: Severity;
	/** Which stage the rule belongs to. Later phases add "paths" and "data". */
	phase: "structure";
	/** One sentence: what the rule enforces. */
	description: string;
	/** Why it matters: what breaks in the Visual Editor. */
	rationale: string;
	/** What this rule mirrors: runtime code (`file:lines`) or docs. Recheck the rule when these change. */
	sources: string[];
	/** Region types `check` runs for. `"*"` means every region. */
	regionTypes: readonly string[] | "*";
	/** Runs once per matching region. */
	check?(node: RegionNode, ctx: RuleContext): void;
	/** Runs once per page, for rules that compare regions with each other. */
	checkPage?(page: Page, ctx: RuleContext): void;
}

export const defineRule = (rule: Rule): Rule => rule;

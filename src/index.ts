export {
	type CheckHtmlOptions,
	type CheckSiteOptions,
	checkHtml,
	checkSite,
} from "./check.ts";
export { type Config, loadConfig, type RuleSetting } from "./config.ts";
export {
	buildRegionTree,
	flattenRegions,
	type RegionNode,
} from "./model/region-tree.ts";
export { type Format, format, summarize } from "./report/formatters.ts";
export type { Rule, RuleContext, Severity } from "./rules/define-rule.ts";
export { rules } from "./rules/index.ts";

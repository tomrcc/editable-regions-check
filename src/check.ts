import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { glob } from "tinyglobby";
import { VFile } from "vfile";
import type { Config } from "./config.ts";
import { buildRegionTree, flattenRegions } from "./model/region-tree.ts";
import { parse } from "./parse.ts";
import type { Rule, RuleContext, Severity } from "./rules/define-rule.ts";
import { rules as allRules } from "./rules/index.ts";

export const MESSAGE_SOURCE = "editable-regions";

const activeRules = (
	rules: readonly Rule[],
	config: Config,
): { rule: Rule; severity: Severity }[] =>
	rules.flatMap((rule) => {
		const setting = config.rules?.[rule.id] ?? rule.severity;
		return setting === "off" ? [] : [{ rule, severity: setting }];
	});

export interface CheckHtmlOptions {
	/** Used in diagnostics. */
	path?: string;
	config?: Config;
	/** Run only these rules (defaults to all). */
	rules?: readonly Rule[];
}

/** Check one page. Diagnostics are on the returned file's `messages`. */
export const checkHtml = (
	html: string,
	options: CheckHtmlOptions = {},
): VFile => {
	const config = options.config ?? {};
	const file = new VFile({ path: options.path, value: html });
	const regions = flattenRegions(
		buildRegionTree(parse(file), {
			customRegionTypes: config.customRegionTypes,
		}),
	).filter((region) => !region.ignored);

	for (const { rule, severity } of activeRules(
		options.rules ?? allRules,
		config,
	)) {
		const ctx: RuleContext = {
			report(region, reason, { hint, attribute } = {}) {
				const place = attribute
					? (region.attributes.attribute(attribute)?.position ??
						region.position)
					: region.position;
				const text = region.inTemplate
					? `${reason} (in a <template> blueprint)`
					: reason;
				const message = file.message(text, {
					place,
					ruleId: rule.id,
					source: MESSAGE_SOURCE,
				});
				message.fatal = severity === "error";
				if (hint) {
					message.note = hint;
				}
			},
		};

		if (rule.check) {
			for (const region of regions) {
				if (
					rule.regionTypes === "*" ||
					rule.regionTypes.includes(region.type)
				) {
					rule.check(region, ctx);
				}
			}
		}
		rule.checkPage?.({ regions }, ctx);
	}

	file.messages.sort(
		(a, b) =>
			(a.line ?? 0) - (b.line ?? 0) || (a.column ?? 0) - (b.column ?? 0),
	);
	return file;
};

export interface CheckSiteOptions {
	/** The built site's output directory. */
	dir: string;
	config?: Config;
}

/** Check every `.html` file under `dir`. Returns one file per page, in path order. */
export const checkSite = async ({
	dir,
	config = {},
}: CheckSiteOptions): Promise<VFile[]> => {
	const paths = await glob("**/*.html", {
		cwd: dir,
		ignore: config.ignore ?? [],
	});
	paths.sort();

	return Promise.all(
		paths.map(async (path) => {
			const fullPath = join(dir, path);
			return checkHtml(await readFile(fullPath, "utf8"), {
				path: fullPath,
				config,
			});
		}),
	);
};

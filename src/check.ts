import { readFile } from "node:fs/promises";
import { join, relative } from "node:path";
import { glob } from "tinyglobby";
import { VFile } from "vfile";
import type { Config } from "./config.ts";
import type { PageContent } from "./content/lookup.ts";
import { buildSiteIndex } from "./content/site-index.ts";
import { buildRegionTree, flattenRegions } from "./model/region-tree.ts";
import { resolvePaths } from "./model/resolve-paths.ts";
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
	/** The site's content. Without it, `data` rules are skipped. */
	content?: PageContent;
}

/** Check one page. Diagnostics are on the returned file's `messages`. */
export const checkHtml = (
	html: string,
	options: CheckHtmlOptions = {},
): VFile => {
	const config = options.config ?? {};
	const file = new VFile({ path: options.path, value: html });
	const allRegions = flattenRegions(
		buildRegionTree(parse(file), {
			customRegionTypes: config.customRegionTypes,
		}),
	);
	resolvePaths(allRegions);
	const regions = allRegions.filter((region) => !region.ignored);

	for (const { rule, severity } of activeRules(
		options.rules ?? allRules,
		config,
	)) {
		if (rule.phase === "data" && !options.content) {
			continue;
		}
		const ctx: RuleContext = {
			content: options.content,
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
	/** The project root holding `cloudcannon.config.*`. Enables the `data` rules. */
	source?: string;
	config?: Config;
}

/**
 * Check every `.html` file under `dir`. Returns one file per page, in path
 * order. With `source`, the first file is the CloudCannon config, carrying
 * problems found while mapping pages to their source files.
 */
export const checkSite = async ({
	dir,
	source,
	config = {},
}: CheckSiteOptions): Promise<VFile[]> => {
	const paths = await glob("**/*.html", {
		cwd: dir,
		ignore: config.ignore ?? [],
	});
	paths.sort();

	const site = source
		? await buildSiteIndex({ projectDir: source, outputPages: paths })
		: undefined;

	const pages = await Promise.all(
		paths.map(async (path) => {
			const fullPath = join(dir, path);
			return checkHtml(await readFile(fullPath, "utf8"), {
				path: fullPath,
				config,
				content: site ? { site, file: site.pageFor(path) } : undefined,
			});
		}),
	);
	if (!site || !source) {
		return pages;
	}

	const siteFile = new VFile({ path: site.configPath });
	for (const warning of site.warnings) {
		siteFile.message(warning, { ruleId: "site-index", source: MESSAGE_SOURCE });
	}
	const unmapped = paths.filter((path) => !site.pageFor(path));
	if (unmapped.length > 0) {
		const info = siteFile.info(
			`${unmapped.length} of ${paths.length} pages have no source file, so paths relative to the page aren't checked against data`,
			{ ruleId: "site-index", source: MESSAGE_SOURCE },
		);
		info.note = `Pages map to files through each collection's \`url\` in \`collections_config\`. Unmapped: ${unmapped
			.slice(0, 10)
			.map((path) => relative(".", join(dir, path)))
			.join(
				", ",
			)}${unmapped.length > 10 ? `, and ${unmapped.length - 10} more` : ""}`;
	}
	return [siteFile, ...pages];
};

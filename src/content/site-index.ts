import { existsSync, readFileSync, statSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { extname, join, posix, relative, sep } from "node:path";
import { glob } from "tinyglobby";
import { type CloudCannonConfig, loadCloudCannonConfig } from "./cc-config.ts";
import { parseFile } from "./parse-file.ts";
import {
	evaluateUrlTemplate,
	UnsupportedTemplateError,
} from "./url-template.ts";

export interface SourceFile {
	/** Path relative to the site source, with `/` separators. */
	path: string;
	/** Frontmatter, or the whole file for data files. */
	data: unknown;
	/** Body content, for `@content`. */
	content: string | undefined;
	/** Set when the file couldn't be read or parsed; `data` is then `{}`. */
	error?: string;
}

export interface SiteIndex {
	/** The `cloudcannon.config.*` file that was read. */
	configPath: string;
	sourceDir: string;
	config: CloudCannonConfig;
	/** The source file whose output is this page (path relative to the output dir). */
	pageFor(outputPath: string): SourceFile | undefined;
	/** A collection's files, in path order. `undefined` if the key isn't in `collections_config`. */
	collection(key: string): SourceFile[] | undefined;
	/** A dataset: one file, or a directory's files. `undefined` if the key isn't in `data_config` or its path doesn't exist. */
	dataset(key: string): SourceFile | SourceFile[] | undefined;
	/** Any file by path relative to the site source (a leading `/` is allowed). */
	file(path: string): SourceFile | undefined;
	/** Problems building the index, e.g. unsupported url templates or two files claiming one URL. */
	warnings: string[];
}

/** Files CloudCannon reads structured data from. Others (templates, images) are left out of collections. */
const DATA_FILE_EXTENSIONS = new Set([
	".md",
	".mdx",
	".markdown",
	".html",
	".htm",
	".yml",
	".yaml",
	".json",
	".toml",
	".njk",
	".liquid",
]);

const toPosix = (path: string) => path.split(sep).join("/");

const toArray = (value: string | string[] | undefined) =>
	value === undefined ? [] : Array.isArray(value) ? value : [value];

/** The output files a URL can be served from, most likely first. */
const outputCandidates = (url: string): string[] => {
	const path = url.split(/[?#]/)[0].replace(/^\/+/, "");
	if (path === "" || path.endsWith("/")) {
		return [`${path}index.html`];
	}
	if (extname(path) === ".html" || extname(path) === ".htm") {
		return [path];
	}
	return [`${path}.html`, `${path}/index.html`];
};

export interface BuildSiteIndexOptions {
	/** The project root holding `cloudcannon.config.*`. */
	projectDir: string;
	/** Built pages, relative to the output directory. Used to pick between `/a.html` and `/a/index.html`. */
	outputPages: readonly string[];
}

export const buildSiteIndex = async ({
	projectDir,
	outputPages,
}: BuildSiteIndexOptions): Promise<SiteIndex> => {
	const { configPath, sourceDir, config } =
		await loadCloudCannonConfig(projectDir);
	const warnings: string[] = [];
	const files = new Map<string, SourceFile>();

	const readSourceFile = (path: string, text: string): SourceFile => {
		try {
			return { path, ...parseFile(path, text) };
		} catch (error) {
			const reason = error instanceof Error ? error.message : String(error);
			warnings.push(`Couldn't parse ${path}: ${reason}`);
			return { path, data: {}, content: undefined, error: reason };
		}
	};

	const loadFile = async (path: string): Promise<SourceFile> => {
		const cached = files.get(path);
		if (cached) {
			return cached;
		}
		const file = readSourceFile(
			path,
			await readFile(join(sourceDir, path), "utf8"),
		);
		files.set(path, file);
		return file;
	};

	const loadFileSync = (path: string): SourceFile | undefined => {
		const cached = files.get(path);
		if (cached) {
			return cached;
		}
		const full = join(sourceDir, path);
		if (!existsSync(full) || !statSync(full).isFile()) {
			return undefined;
		}
		const file = readSourceFile(path, readFileSync(full, "utf8"));
		files.set(path, file);
		return file;
	};

	const globFiles = async (dir: string, patterns: string[]) => {
		const positive = patterns.filter((pattern) => !pattern.startsWith("!"));
		const found = await glob(positive.length > 0 ? positive : ["**/*"], {
			cwd: join(sourceDir, dir),
			ignore: [
				"**/node_modules/**",
				...patterns
					.filter((pattern) => pattern.startsWith("!"))
					.map((pattern) => pattern.slice(1)),
			],
		});
		return found
			.filter((path) => DATA_FILE_EXTENSIONS.has(extname(path).toLowerCase()))
			.sort()
			.map((path) => toPosix(posix.join(dir, path)));
	};

	const collections = new Map<string, SourceFile[]>();
	const pages = new Map<string, SourceFile>();
	const outputSet = new Set(outputPages.map(toPosix));

	for (const [key, collection] of Object.entries(
		config.collections_config ?? {},
	)) {
		const dir = collection.path ?? "";
		const paths = await globFiles(dir, toArray(collection.glob));
		const members = await Promise.all(paths.map(loadFile));
		collections.set(key, members);

		if (!collection.url || collection.disable_url) {
			continue;
		}
		for (const file of members) {
			let url: string;
			try {
				url = evaluateUrlTemplate(collection.url, {
					path: file.path,
					relativePath: posix.relative(dir, file.path),
					collection: key,
					data: file.data,
				});
			} catch (error) {
				if (error instanceof UnsupportedTemplateError) {
					warnings.push(
						`Collection \`${key}\`: url \`${collection.url}\` has an ${error.message}, so its pages aren't checked against their data`,
					);
					break;
				}
				throw error;
			}

			const candidates = outputCandidates(url);
			const output =
				candidates.find((candidate) => outputSet.has(candidate)) ??
				candidates[0];
			const existing = pages.get(output);
			if (existing && existing !== file) {
				warnings.push(
					`${existing.path} and ${file.path} both have the URL ${url}; checking ${output} against ${existing.path}`,
				);
				continue;
			}
			pages.set(output, file);
		}
	}

	const datasets = new Map<string, SourceFile | SourceFile[]>();
	for (const [key, dataset] of Object.entries(config.data_config ?? {})) {
		const path = toPosix(dataset.path ?? "").replace(/^\/+/, "");
		const full = join(sourceDir, path);
		if (!existsSync(full)) {
			continue;
		}
		datasets.set(
			key,
			statSync(full).isDirectory()
				? await Promise.all((await globFiles(path, [])).map(loadFile))
				: await loadFile(path),
		);
	}

	return {
		configPath,
		sourceDir,
		config,
		warnings,
		pageFor: (outputPath) => pages.get(toPosix(outputPath)),
		collection: (key) => collections.get(key),
		dataset: (key) => datasets.get(key),
		file: (path) => {
			const normalized = toPosix(path).replace(/^\/+/, "");
			if (relative(sourceDir, join(sourceDir, normalized)).startsWith("..")) {
				return undefined;
			}
			return loadFileSync(normalized);
		},
	};
};

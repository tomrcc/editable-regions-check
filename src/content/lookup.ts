import type { Binding, PathRoot, Segment } from "../model/resolve-paths.ts";
import type { SiteIndex, SourceFile } from "./site-index.ts";

/** A whole file as a value, like the runtime's API file objects. */
export class FileValue {
	readonly file: SourceFile;
	constructor(file: SourceFile) {
		this.file = file;
	}
}

/** A collection or directory dataset as a value: a list of files. */
export class FilesValue {
	readonly files: SourceFile[];
	constructor(files: SourceFile[]) {
		this.files = files;
	}
}

export interface PageContent {
	site: SiteIndex;
	/** The page's own source file, when its URL mapped to one. */
	file: SourceFile | undefined;
}

export type LookupResult =
	| {
			outcome: "found";
			value: unknown;
			/** The collection file this result came from, when a lookup fans out over a collection. */
			via?: SourceFile;
	  }
	| {
			outcome: "missing";
			/** Index of the first segment that wasn't there. */
			missingAt: number;
			/** The value the missing segment was looked up in. */
			container: unknown;
			via?: SourceFile;
	  }
	/** `@collections`, `@data` or `@file` names something that doesn't exist. */
	| { outcome: "no-target"; message: string }
	/** The path is relative to a page that didn't map to a source file. */
	| { outcome: "skipped" };

const rootValue = (
	content: PageContent,
	root: PathRoot,
): FileValue | FilesValue | { message: string } | undefined => {
	const { site } = content;
	switch (root.kind) {
		case "page":
			return content.file ? new FileValue(content.file) : undefined;
		case "collection": {
			const files = site.collection(root.key);
			return files
				? new FilesValue(files)
				: {
						message: `\`@collections[${root.key}]\`: there's no \`${root.key}\` in \`collections_config\``,
					};
		}
		case "data": {
			const dataset = site.dataset(root.key);
			if (dataset) {
				return Array.isArray(dataset)
					? new FilesValue(dataset)
					: new FileValue(dataset);
			}
			const entry = site.config.data_config?.[root.key];
			return {
				message: entry
					? `\`@data[${root.key}]\`: its \`data_config\` path \`${entry.path}\` doesn't exist`
					: `\`@data[${root.key}]\`: there's no \`${root.key}\` in \`data_config\``,
			};
		}
		case "file": {
			const file = site.file(root.path);
			return file
				? new FileValue(file)
				: {
						message: `\`@file[${root.path}]\`: there's no file at \`${root.path}\` in the site source`,
					};
		}
	}
};

const isIndex = (segment: Segment) =>
	typeof segment === "object" ||
	typeof segment === "number" ||
	/^\d+$/.test(segment);

/**
 * Looks a resolved path up in the site's content, mirroring
 * `Editable.lookupPathAndContext` (`editable.ts:106-173`): files are read
 * through their data (or body, for `@content`), and collections and directory
 * datasets are lists of files.
 *
 * CloudCannon's order for a collection's files isn't known here, so an index
 * into one checks every file and returns a result per file.
 */
export const lookup = (
	content: PageContent,
	root: PathRoot,
	segments: Segment[],
): LookupResult[] => {
	const start = rootValue(content, root);
	if (start === undefined) {
		return [{ outcome: "skipped" }];
	}
	if (!(start instanceof FileValue || start instanceof FilesValue)) {
		return [{ outcome: "no-target", message: start.message }];
	}

	const walk = (
		value: unknown,
		index: number,
		via: SourceFile | undefined,
	): LookupResult[] => {
		if (index === segments.length) {
			return [{ outcome: "found", value, via }];
		}
		const segment = segments[index];

		if (value instanceof FilesValue && isIndex(segment)) {
			return value.files.flatMap((file) =>
				walk(new FileValue(file), index + 1, file),
			);
		}

		let container = value;
		if (value instanceof FileValue) {
			if (segment === "@content") {
				return value.file.content === undefined
					? [{ outcome: "missing", missingAt: index, container: value, via }]
					: walk(value.file.content, index + 1, via);
			}
			container = value.file.data;
		} else if (value instanceof FilesValue) {
			container = value.files;
		}

		const key = typeof segment === "object" ? "0" : String(segment);
		if (container && typeof container === "object" && key in container) {
			return walk((container as Record<string, unknown>)[key], index + 1, via);
		}
		return [{ outcome: "missing", missingAt: index, container, via }];
	};

	return walk(start, 0, undefined);
};

/** Looks up a binding that resolved to a path. Returns nothing for specials, literals and unresolvable bindings. */
export const lookupBinding = (
	content: PageContent,
	binding: Binding,
): LookupResult[] =>
	binding.resolved.status === "path"
		? lookup(content, binding.resolved.root, binding.resolved.segments)
		: [];

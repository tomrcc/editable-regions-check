import { posix } from "node:path";

/**
 * Evaluates a collection's `url` template for one file, following
 * https://cloudcannon.com/documentation/developer-articles/update-the-output-url-for-a-collection/
 * and the filter list at
 * https://cloudcannon.com/documentation/articles/configure-your-template-strings/#filters
 */

export interface UrlTemplateFile {
	/** Path relative to the site source, e.g. `content/blog/2024/post.md`. */
	path: string;
	/** Path relative to the collection's `path`, e.g. `2024/post.md`. */
	relativePath: string;
	collection: string;
	data: unknown;
}

export class UnsupportedTemplateError extends Error {}

const stripExt = (path: string) => {
	const ext = posix.extname(path);
	return ext ? path.slice(0, -ext.length) : path;
};

const joinParts = (...parts: string[]) =>
	parts.filter((part) => part !== "" && part !== ".").join("/");

const fixedPlaceholders = (file: UrlTemplateFile): Record<string, string> => {
	const filename = posix.basename(file.path);
	const base = stripExt(filename);
	const slug = base === "index" ? "" : base;
	const relativeDir = posix.dirname(file.relativePath);
	return {
		filename,
		slug,
		ext: posix.extname(filename).slice(1),
		path: file.path,
		base_path: stripExt(file.path),
		relative_path: file.relativePath,
		relative_base_path: stripExt(file.relativePath),
		// The docs call this `[relative_base_path]/[slug]`; in practice it's the
		// directory relative to the collection plus the slug, so `blog/index.md`
		// gives `blog` and `blog/post.md` gives `blog/post`.
		full_slug: joinParts(relativeDir, slug),
		collection: file.collection,
	};
};

/** `{seo.title}`, `{links[0].text}`, `{tags[*]}`. */
const readData = (data: unknown, key: string): unknown => {
	const parts = key.match(/[^.[\]]+|\[\*\]/g) ?? [];
	let values: unknown[] = [data];
	for (const part of parts) {
		if (part === "[*]") {
			values = values.flatMap((value) => (Array.isArray(value) ? value : []));
			continue;
		}
		values = values.map((value) =>
			value && typeof value === "object"
				? (value as Record<string, unknown>)[part]
				: undefined,
		);
	}
	if (key.includes("[*]")) {
		return values.filter((value) => value != null).join(", ");
	}
	return values[0];
};

const isEmpty = (value: unknown) =>
	value === undefined || value === null || value === "" || value === false;

const DEBURR: Record<string, string> = {
	ß: "ss",
	æ: "ae",
	Æ: "AE",
	ø: "o",
	Ø: "O",
	đ: "d",
	Đ: "D",
	ł: "l",
	Ł: "L",
	œ: "oe",
	Œ: "OE",
	þ: "th",
	Þ: "TH",
};

const deburr = (text: string) =>
	text
		.normalize("NFD")
		.replace(/[̀-ͯ]/g, "")
		.replace(/[ßæÆøØđĐłŁœŒþÞ]/g, (char) => DEBURR[char] ?? char);

const slugify = (text: string) =>
	text
		.replace(/[^a-zA-Z0-9]+/g, "-")
		.replace(/-+/g, "-")
		.replace(/^-|-$/g, "");

const datePart = (value: unknown, part: "year" | "month" | "day") => {
	const date = new Date(String(value));
	if (Number.isNaN(date.getTime())) {
		return "";
	}
	if (part === "year") {
		return String(date.getUTCFullYear());
	}
	const n = part === "month" ? date.getUTCMonth() + 1 : date.getUTCDate();
	return String(n).padStart(2, "0");
};

const applyFilter = (
	value: unknown,
	filter: string,
	file: UrlTemplateFile,
): unknown => {
	const [name, arg = ""] = filter.split("=");
	const text = isEmpty(value) ? "" : String(value);
	switch (name.trim()) {
		case "uppercase":
			return text.toUpperCase();
		case "lowercase":
			return text.toLowerCase();
		case "deburr":
			return deburr(text);
		case "slugify":
			return slugify(text);
		case "trim":
			return text.trim();
		case "year":
		case "month":
		case "day":
			return datePart(value, name.trim() as "year" | "month" | "day");
		case "truncate":
			return text.slice(0, Number(arg));
		case "default":
			return isEmpty(value) ? arg : value;
		case "if":
			return isEmpty(readData(file.data, arg)) ? "" : value;
		case "unless":
			return isEmpty(readData(file.data, arg)) ? value : "";
		case "substring": {
			const [start, end] = arg.split(",").map(Number);
			return text.substring(start, end);
		}
		case "strip_leading_date":
			return text.replace(/(^|\/)\d{4}-\d{2}-\d{2}-/, "$1");
		default:
			throw new UnsupportedTemplateError(`unsupported filter \`${name}\``);
	}
};

/**
 * Returns the output URL, with repeated slashes collapsed. Throws
 * `UnsupportedTemplateError` for placeholders or filters it doesn't know,
 * rather than guessing.
 */
export const evaluateUrlTemplate = (
	template: string,
	file: UrlTemplateFile,
): string => {
	const fixed = fixedPlaceholders(file);
	const url = template.replace(
		/\[([^\]|]+)((?:\|[^\]]*)?)\]|\{([^}|]+)((?:\|[^}]*)?)\}/g,
		(_match, fixedName, fixedFilters, dataKey, dataFilters) => {
			let value: unknown;
			if (fixedName !== undefined) {
				const name = fixedName.trim();
				if (!Object.hasOwn(fixed, name)) {
					throw new UnsupportedTemplateError(
						`unsupported placeholder \`[${name}]\``,
					);
				}
				value = fixed[name];
			} else {
				value = readData(file.data, dataKey.trim());
			}
			const filters: string = fixedFilters || dataFilters || "";
			for (const filter of filters.split("|").slice(1)) {
				value = applyFilter(value, filter, file);
			}
			return isEmpty(value) ? "" : String(value);
		},
	);
	return url.replace(/\/{2,}/g, "/");
};

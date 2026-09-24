import type { RegionNode } from "../model/region-tree.ts";
import { liveItems } from "../model/region-tree.ts";
import type { Binding } from "../model/resolve-paths.ts";
import { FilesValue, FileValue } from "./lookup.ts";
import type { SourceFile } from "./site-index.ts";

/** A value's type in the words the runtime's error cards use, plus `array` and `null`. */
export const describeType = (value: unknown): string => {
	if (value === null) {
		return "null";
	}
	if (Array.isArray(value)) {
		return "array";
	}
	if (value instanceof FileValue) {
		return "file";
	}
	if (value instanceof FilesValue) {
		return "collection";
	}
	return typeof value;
};

/**
 * How a message names a binding: the attribute as written, or the item's
 * position for array items, whose path comes from where they sit.
 */
export const describeBinding = (node: RegionNode, binding: Binding): string => {
	if (node.type === "array-item" && binding.key === undefined && node.parent) {
		return `Array item ${liveItems(node.parent).indexOf(node) + 1}`;
	}
	return `\`${binding.attribute}="${binding.raw}"\``;
};

/** `a string`, `an object`, `null`. */
export const withArticle = (value: unknown): string => {
	const type = describeType(value);
	if (type === "null") {
		return type;
	}
	return /^[aeiou]/.test(type) ? `an ${type}` : `a ${type}`;
};

/** The keys a missing segment could have been, for hints. */
export const availableKeys = (container: unknown): string[] => {
	if (container instanceof FileValue) {
		return availableKeys(container.file.data);
	}
	if (Array.isArray(container) || container instanceof FilesValue) {
		return [];
	}
	return container && typeof container === "object"
		? Object.keys(container)
		: [];
};

const distance = (a: string, b: string): number => {
	let previous = Array.from({ length: b.length + 1 }, (_, i) => i);
	for (let i = 1; i <= a.length; i++) {
		const current = [i];
		for (let j = 1; j <= b.length; j++) {
			current[j] = Math.min(
				previous[j] + 1,
				current[j - 1] + 1,
				previous[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1),
			);
		}
		previous = current;
	}
	return previous[b.length];
};

/** The closest key by edit distance, if it's close enough to be a likely typo or case slip. */
export const closestKey = (
	key: string,
	keys: readonly string[],
): string | undefined => {
	let best: { key: string; score: number } | undefined;
	for (const candidate of keys) {
		const score =
			candidate.toLowerCase() === key.toLowerCase()
				? 0
				: distance(key.toLowerCase(), candidate.toLowerCase());
		if (!best || score < best.score) {
			best = { key: candidate, score };
		}
	}
	return best && best.score <= Math.max(1, Math.floor(key.length / 3))
		? best.key
		: undefined;
};

/** `a.md, b.md and 3 more`. */
export const listFiles = (files: SourceFile[], max = 3): string => {
	const names = files.slice(0, max).map((file) => `\`${file.path}\``);
	return files.length > max
		? `${names.join(", ")} and ${files.length - max} more`
		: names.join(", ");
};

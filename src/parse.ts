import type { Root } from "hast";
import { fromHtml } from "hast-util-from-html";
import type { VFile } from "vfile";

/**
 * Parse a page the way a browser would (parse5, via hast), keeping positions
 * for every element and attribute.
 */
export const parse = (file: VFile): Root => fromHtml(file, { verbose: true });

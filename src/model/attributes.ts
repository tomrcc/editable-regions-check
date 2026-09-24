import type { Element } from "hast";
import { find, html } from "property-information";
import type { Position } from "unist";

export interface Attribute {
	/** The attribute name as written in HTML (lowercased by the parser), e.g. `data-prop-src`. */
	name: string;
	value: string;
	position: Position | undefined;
}

interface ElementPositionData {
	position?: {
		opening?: Position;
		properties?: Record<string, Position | undefined>;
	};
}

/**
 * Raw attribute access for a hast element.
 *
 * hast stores attributes as camelCased properties (`data-prop-src` becomes
 * `dataPropSrc`). This is the only place that knows about that mapping, so
 * rules can work with the attribute names people actually write.
 */
export class Attributes {
	readonly #byName = new Map<string, Attribute>();

	constructor(element: Element) {
		const positions = (element.data as ElementPositionData | undefined)
			?.position?.properties;

		for (const [property, raw] of Object.entries(element.properties)) {
			if (raw === undefined || raw === null || raw === false) {
				continue;
			}

			const name = find(html, property).attribute;
			const value = Array.isArray(raw)
				? raw.join(" ")
				: raw === true
					? ""
					: String(raw);
			this.#byName.set(name, { name, value, position: positions?.[property] });
		}
	}

	has(name: string): boolean {
		return this.#byName.has(name);
	}

	get(name: string): string | undefined {
		return this.#byName.get(name)?.value;
	}

	attribute(name: string): Attribute | undefined {
		return this.#byName.get(name);
	}

	[Symbol.iterator](): IterableIterator<Attribute> {
		return this.#byName.values();
	}
}

export const openingTagPosition = (element: Element): Position | undefined =>
	(element.data as ElementPositionData | undefined)?.position?.opening ??
	element.position;

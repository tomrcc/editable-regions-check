/**
 * Values mirrored from the editable-regions runtime. Each list notes where it
 * comes from; `drift.test.ts` fails when the runtime's lists change.
 */

/** Keys of `baseEditableMap` in `editable-regions/helpers/hydrate-editable-regions.ts`. */
export const ATTRIBUTE_REGION_TYPES = [
	"array",
	"array-item",
	"component",
	"image",
	"source",
	"text",
] as const;

/** Suffixes of `editable-regions/components/editable-*-component.ts`. */
export const ELEMENT_REGION_TYPES = [
	"array",
	"array-item",
	"component",
	"image",
	"snippet",
	"source",
	"text",
] as const;

/** `DYNAMIC_EDITABLE_TYPE` in `hydrate-editable-regions.ts`, used by the React/Vue/Svelte wrappers. */
export const DYNAMIC_REGION_TYPE = "_dynamic";

/** Custom element prefix checked by `isEditableWebcomponent` in `editable-regions/helpers/checks.ts`. */
export const ELEMENT_PREFIX = "editable-";

/** `data-type` values accepted by `EditableText.validateConfiguration`. */
export const TEXT_DATA_TYPES = ["span", "text", "block"] as const;

/** Attributes the image region accepts in `EditableImage.validateConfiguration`. */
export const IMAGE_PROP_ATTRIBUTES = [
	"data-prop",
	"data-prop-src",
	"data-prop-alt",
	"data-prop-title",
] as const;

export const IGNORE_ATTRIBUTE = "data-cloudcannon-ignore";

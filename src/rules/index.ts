// Every rule, in the order they appear in RULES.md. Add or remove one line per rule.
import arrayItemRequiresArray from "./array-item-requires-array/rule.ts";
import arrayKeyedItemMissingId from "./array-keyed-item-missing-id/rule.ts";
import arrayNonItemChildren from "./array-non-item-children/rule.ts";
import arrayRequiresItems from "./array-requires-items/rule.ts";
import arrayRequiresProp from "./array-requires-prop/rule.ts";
import blockInPhrasingHost from "./block-in-phrasing-host/rule.ts";
import componentEmptyProp from "./component-empty-prop/rule.ts";
import componentRequiresComponent from "./component-requires-component/rule.ts";
import type { Rule } from "./define-rule.ts";
import imageRequiresImg from "./image-requires-img/rule.ts";
import imageRequiresProp from "./image-requires-prop/rule.ts";
import propAttrHyphenated from "./prop-attr-hyphenated/rule.ts";
import propPathMalformed from "./prop-path-malformed/rule.ts";
import propPathMissing from "./prop-path-missing/rule.ts";
import propTargetNotFound from "./prop-target-not-found/rule.ts";
import propUnbound from "./prop-unbound/rule.ts";
import propValueType from "./prop-value-type/rule.ts";
import sourceDuplicateKey from "./source-duplicate-key/rule.ts";
import sourceRequiresKey from "./source-requires-key/rule.ts";
import sourceRequiresPath from "./source-requires-path/rule.ts";
import specialPropOutOfScope from "./special-prop-out-of-scope/rule.ts";
import textInvalidType from "./text-invalid-type/rule.ts";
import textRequiresProp from "./text-requires-prop/rule.ts";
import unknownRegionType from "./unknown-region-type/rule.ts";
import unsupportedNamedProp from "./unsupported-named-prop/rule.ts";
import valueRegionHasChildren from "./value-region-has-children/rule.ts";

export const rules: readonly Rule[] = [
	unknownRegionType,
	textRequiresProp,
	textInvalidType,
	imageRequiresImg,
	imageRequiresProp,
	arrayRequiresProp,
	arrayItemRequiresArray,
	arrayRequiresItems,
	arrayNonItemChildren,
	arrayKeyedItemMissingId,
	componentRequiresComponent,
	componentEmptyProp,
	sourceRequiresPath,
	sourceRequiresKey,
	sourceDuplicateKey,
	valueRegionHasChildren,
	blockInPhrasingHost,
	propAttrHyphenated,
	unsupportedNamedProp,
	// Paths
	propPathMalformed,
	specialPropOutOfScope,
	propUnbound,
	// Data
	propTargetNotFound,
	propPathMissing,
	propValueType,
];

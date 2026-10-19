// Node 22 supports JSON import attributes, but the package build uses TypeScript's Node16 module mode.
// biome-ignore lint/suspicious/noTsIgnore: the Node16 package compiler rejects supported Node 22 import attributes.
// @ts-ignore TS2823: the emitted ESM import attribute is supported by the declared Node runtime.
import definition from "../theme/finecode.json" with { type: "json" };
import type { ValidatedThemeJson as ThemeJson } from "../theme/theme-schema.ts";

export const FINECODE_THEME_NAME = definition.name;

/** The packaged asset and embedded theme share the same canonical JSON definition. */
export const finecodeThemeDefinition = definition as ThemeJson;

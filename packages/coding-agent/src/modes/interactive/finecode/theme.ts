import definition from "../theme/finecode.json" with { type: "json" };
import type { ValidatedThemeJson as ThemeJson } from "../theme/theme-schema.ts";

export const FINECODE_THEME_NAME = definition.name;

/** The packaged asset and embedded theme share the same canonical JSON definition. */
export const finecodeThemeDefinition = definition as ThemeJson;

import { fineCodeLogoLines, fineCodeWordmark, supportsFineCodeLogo } from "../finecode/brand.ts";

export { fineCodeLogoLines, fineCodeWordmark, supportsFineCodeLogo };

export function piLogoLines(): [string, string] {
	return fineCodeLogoLines();
}

export function supportsPiLogo(): boolean {
	return supportsFineCodeLogo();
}

export function piWordmark(): string {
	return fineCodeWordmark();
}

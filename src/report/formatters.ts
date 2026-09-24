import type { VFile } from "vfile";
import { reporter } from "vfile-reporter";

export type Format = "pretty" | "json";

export interface Summary {
	errors: number;
	warnings: number;
}

export const summarize = (files: VFile[]): Summary => {
	const summary = { errors: 0, warnings: 0 };
	for (const file of files) {
		for (const message of file.messages) {
			if (message.fatal) {
				summary.errors += 1;
			} else if (message.fatal === false) {
				summary.warnings += 1;
			}
		}
	}
	return summary;
};

const pretty = (files: VFile[]): string =>
	reporter(files, { quiet: true, verbose: true });

const json = (files: VFile[]): string =>
	JSON.stringify(
		files
			.filter((file) => file.messages.length > 0)
			.map((file) => ({
				path: file.path,
				messages: file.messages.map((message) => ({
					ruleId: message.ruleId,
					severity: message.fatal
						? "error"
						: message.fatal === false
							? "warn"
							: "info",
					message: message.reason,
					hint: message.note,
					line: message.line,
					column: message.column,
				})),
			})),
		null,
		2,
	);

export const format = (files: VFile[], type: Format): string =>
	type === "json" ? json(files) : pretty(files);

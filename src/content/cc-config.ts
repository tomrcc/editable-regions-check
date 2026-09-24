import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { parse as parseYaml } from "yaml";

/** The parts of `cloudcannon.config.*` the checker reads. */
export interface CloudCannonConfig {
	source?: string;
	collections_config?: Record<
		string,
		{
			path?: string;
			glob?: string | string[];
			url?: string;
			disable_url?: boolean;
		}
	>;
	data_config?: Record<string, { path?: string }>;
}

export interface LoadedConfig {
	/** Where the config was read from. */
	configPath: string;
	/** Absolute site source directory: the project root plus `source`. */
	sourceDir: string;
	config: CloudCannonConfig;
}

/** The file names CloudCannon looks for, in its order. */
const CONFIG_NAMES = [
	"cloudcannon.config.json",
	"cloudcannon.config.yaml",
	"cloudcannon.config.yml",
	"cloudcannon.config.js",
	"cloudcannon.config.cjs",
	"cloudcannon.config.mjs",
];

export const loadCloudCannonConfig = async (
	projectDir: string,
): Promise<LoadedConfig> => {
	const name = CONFIG_NAMES.find((candidate) =>
		existsSync(join(projectDir, candidate)),
	);
	if (!name) {
		throw new Error(
			`No CloudCannon configuration file found in ${projectDir} (looked for ${CONFIG_NAMES.join(", ")})`,
		);
	}

	const configPath = join(projectDir, name);
	let config: CloudCannonConfig;
	if (name.endsWith(".json")) {
		config = JSON.parse(await readFile(configPath, "utf8"));
	} else if (name.endsWith(".yml") || name.endsWith(".yaml")) {
		config = parseYaml(await readFile(configPath, "utf8")) ?? {};
	} else {
		const module = await import(pathToFileURL(resolve(configPath)).href);
		config = module.default ?? module;
	}

	return {
		configPath,
		sourceDir: resolve(projectDir, config.source ?? ""),
		config,
	};
};

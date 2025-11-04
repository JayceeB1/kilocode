import { z } from "zod"
import { readFileSync } from "fs"
import { join } from "path"

const SupervisorConfigSchema = z.object({
	bind: z.string().default("127.0.0.1"),
	port: z.number().int().positive().default(43110),
	provider: z.enum(["ollama", "lmstudio", "openai"]).default("ollama"),
	model: z.string().default("llama3.1:8b-instruct-q4"),
	max_tokens: z.number().int().positive().default(768),
	temperature: z.number().min(0).max(2).default(0.2),
	autoFixWhitelist: z.array(z.string()).default(["path_not_found", "missing_dep", "flaky_test_rerun"]),
	autoFixMinConfidence: z.number().min(0).max(1).default(0.75),
	reflexion: z
		.object({
			enabled: z.boolean().default(true),
			maxItems: z.number().int().positive().default(128),
			ttlDays: z.number().int().positive().default(60),
		})
		.default({ enabled: true, maxItems: 128, ttlDays: 60 }),
})

export type SupervisorConfig = z.infer<typeof SupervisorConfigSchema>

let config: SupervisorConfig | null = null

export function loadConfig(configPath?: string): SupervisorConfig {
	if (config) {
		return config
	}

	try {
		const defaultConfigPath = join(process.cwd(), ".kilocode", "supervisor.config.json")
		const pathToUse = configPath || defaultConfigPath
		const configData = readFileSync(pathToUse, "utf-8")
		const parsedConfig = JSON.parse(configData)

		config = SupervisorConfigSchema.parse(parsedConfig)
		return config
	} catch (error) {
		console.warn("Failed to load supervisor config, using defaults:", error)
		config = SupervisorConfigSchema.parse({})
		return config
	}
}

export function getConfig(): SupervisorConfig {
	if (!config) {
		return loadConfig()
	}
	return config
}

export function resetConfig(): void {
	config = null
}

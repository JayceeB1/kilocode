import { describe, test, expect, beforeEach, afterEach } from "vitest"
import { loadConfig, getConfig, resetConfig } from "./config.js"
import { writeFileSync, unlinkSync, existsSync } from "fs"
import { join } from "path"

describe("Config", () => {
	const testConfigPath = join(__dirname, "test-config.json")

	beforeEach(() => {
		resetConfig()
	})

	afterEach(() => {
		if (existsSync(testConfigPath)) {
			unlinkSync(testConfigPath)
		}
		resetConfig()
	})

	test("should load default config when no file exists", () => {
		const config = loadConfig("/non/existent/path.json")

		expect(config.bind).toBe("127.0.0.1")
		expect(config.port).toBe(9611)
		expect(config.provider).toBe("ollama")
		expect(config.endpoint).toBe("http://127.0.0.1:11434")
		expect(config.model).toBe("llama3.1:8b-instruct-q4")
		expect(config.max_tokens).toBe(768)
		expect(config.temperature).toBe(0.2)
		expect(config.allowLAN).toBe(false)
		expect(config.allowedLANs).toEqual(["10.0.4.0/24"])
		expect(config.autoLaunch).toBe(false)
		expect(config.redactLog).toBe(true)
		expect(config.autoFixWhitelist).toEqual(["path_not_found", "missing_dep", "flaky_test_rerun"])
		expect(config.autoFixMinConfidence).toBe(0.75)
		expect(config.reflexion.enabled).toBe(true)
		expect(config.reflexion.maxItems).toBe(128)
		expect(config.reflexion.ttlDays).toBe(60)
	})

	test("should load custom config from file", () => {
		const customConfig = {
			bind: "10.0.4.10",
			port: 9625,
			provider: "llama.cpp",
			endpoint: "http://127.0.0.1:9000",
			model: "custom-model",
			max_tokens: 1024,
			temperature: 0.7,
			allowLAN: true,
			allowedLANs: ["10.0.4.0/24"],
			autoLaunch: true,
			redactLog: false,
			autoFixWhitelist: ["custom_error"],
			autoFixMinConfidence: 0.9,
			reflexion: {
				enabled: false,
				maxItems: 256,
				ttlDays: 30,
			},
		}

		writeFileSync(testConfigPath, JSON.stringify(customConfig, null, 2))

		const config = loadConfig(testConfigPath)

		expect(config.bind).toBe("10.0.4.10")
		expect(config.port).toBe(9625)
		expect(config.provider).toBe("llama.cpp")
		expect(config.endpoint).toBe("http://127.0.0.1:9000")
		expect(config.model).toBe("custom-model")
		expect(config.max_tokens).toBe(1024)
		expect(config.temperature).toBe(0.7)
		expect(config.allowLAN).toBe(true)
		expect(config.allowedLANs).toEqual(["10.0.4.0/24"])
		expect(config.autoLaunch).toBe(true)
		expect(config.redactLog).toBe(false)
		expect(config.autoFixWhitelist).toEqual(["custom_error"])
		expect(config.autoFixMinConfidence).toBe(0.9)
		expect(config.reflexion.enabled).toBe(false)
		expect(config.reflexion.maxItems).toBe(256)
		expect(config.reflexion.ttlDays).toBe(30)
	})

	test("should return cached config on subsequent calls", () => {
		const config1 = loadConfig()
		const config2 = getConfig()

		expect(config1).toBe(config2)
	})

	test("should handle invalid JSON gracefully", () => {
		writeFileSync(testConfigPath, "invalid json content")

		const config = loadConfig(testConfigPath)

		// Should fall back to defaults
		expect(config.bind).toBe("127.0.0.1")
		expect(config.port).toBe(9611)
	})

	test("should validate config schema", () => {
		const invalidConfig = {
			port: "invalid_port", // Should be number
			temperature: 3.0, // Should be <= 2
			provider: "invalid_provider", // Should be enum value
		}

		writeFileSync(testConfigPath, JSON.stringify(invalidConfig, null, 2))

		const config = loadConfig(testConfigPath)

		// Should fall back to defaults for invalid values
		expect(config.port).toBe(9611)
		expect(config.temperature).toBe(0.2)
		expect(config.provider).toBe("ollama")
	})

	test("should reject non-loopback bind when allowLAN is false", () => {
		const invalidConfig = {
			bind: "10.0.0.5",
		}

		writeFileSync(testConfigPath, JSON.stringify(invalidConfig, null, 2))
		const config = loadConfig(testConfigPath)

		expect(config.bind).toBe("127.0.0.1")
	})

	test("should require allowedLANs when allowLAN is true", () => {
		const invalidConfig = {
			bind: "10.0.4.20",
			allowLAN: true,
			allowedLANs: [],
		}

		writeFileSync(testConfigPath, JSON.stringify(invalidConfig, null, 2))
		const config = loadConfig(testConfigPath)

		expect(config.allowLAN).toBe(false)
		expect(config.bind).toBe("127.0.0.1")
	})
})

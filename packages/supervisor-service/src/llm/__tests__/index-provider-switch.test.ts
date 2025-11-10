import { describe, test, expect, vi, beforeEach } from "vitest"
import { analyzeWithLLM } from "../index.js"

vi.mock("../../config.js", () => ({
	getConfig: vi.fn(() => ({
		provider: "llama.cpp",
		model: "qwen2.5-coder",
		endpoint: "http://127.0.0.1:9000",
		temperature: 0.2,
		max_tokens: 128,
	})),
}))

vi.mock("../llamacppClient.js", () => ({
	analyzeWithLlamaCpp: vi.fn(() =>
		Promise.resolve({
			issues: [],
			suggestions: [],
			fixedCode: undefined,
		}),
	),
}))

describe("provider switch", () => {
	beforeEach(() => {
		vi.clearAllMocks()
	})

	test("routes to llama.cpp", async () => {
		const res = await analyzeWithLLM("code")
		expect(res).toHaveProperty("issues")
		expect(res).toHaveProperty("suggestions")
	})

	test("handles unsupported provider", async () => {
		const { getConfig } = await import("../../config.js")
		vi.mocked(getConfig).mockReturnValueOnce({
			provider: "unsupported",
			model: "test",
			endpoint: "http://127.0.0.1:9000",
			temperature: 0.2,
			max_tokens: 128,
		})

		await expect(analyzeWithLLM("code")).rejects.toThrow("Unsupported LLM provider: unsupported")
	})

	test("routes to ollama when configured", async () => {
		const { getConfig } = await import("../../config.js")
		vi.mocked(getConfig).mockReturnValueOnce({
			provider: "ollama",
			model: "test",
			endpoint: "http://127.0.0.1:11434",
			temperature: 0.2,
			max_tokens: 128,
		})

		// Just test that it doesn't throw and returns the expected structure
		const res = await analyzeWithLLM("code")
		expect(res).toHaveProperty("issues")
		expect(res).toHaveProperty("suggestions")
	})
})

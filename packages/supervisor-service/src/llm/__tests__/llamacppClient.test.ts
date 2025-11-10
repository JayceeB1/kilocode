import { describe, test, expect, beforeEach, vi } from "vitest"
import { analyzeWithLlamaCpp } from "../llamacppClient.js"

vi.mock("../../config.js", () => ({
	getConfig: vi.fn(() => ({
		endpoint: "http://127.0.0.1:9000",
		model: "qwen2.5-coder",
		temperature: 0.2,
		max_tokens: 256,
	})),
}))

describe("llama.cpp analyze client", () => {
	beforeEach(() => {
		vi.restoreAllMocks()
	})

	test("parses JSON from OpenAI-compat response", async () => {
		const mockJson = {
			choices: [
				{
					message: {
						content:
							'{"issues":[{"type":"syntax","severity":"warning","message":"semi missing","line":1,"confidence":0.8}],"suggestions":["Add missing semicolon"]}',
					},
				},
			],
		}
		vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve(mockJson) }))

		const res = await analyzeWithLlamaCpp('console.log("hi")')
		expect(res.issues.length).toBeGreaterThan(0)
		expect(res.suggestions[0]).toContain("semicolon")
	})

	test("fallbacks on bad payloads", async () => {
		vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve({ choices: [{}] }) }))
		const res = await analyzeWithLlamaCpp("let a = 1")
		expect(Array.isArray(res.issues)).toBe(true)
	})

	test("handles HTTP errors gracefully", async () => {
		vi.stubGlobal(
			"fetch",
			vi.fn().mockResolvedValue({
				ok: false,
				status: 500,
				text: () => Promise.resolve("Internal Server Error"),
			}),
		)
		const res = await analyzeWithLlamaCpp("let a = 1")
		expect(res.issues.length).toBeGreaterThan(0)
		expect(res.issues[0].message).toContain("Fallback")
	})

	test("extracts JSON from markdown code blocks", async () => {
		const mockJson = {
			choices: [
				{
					message: {
						content: '```json\n{"issues":[],"suggestions":["Test suggestion"]}\n```',
					},
				},
			],
		}
		vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve(mockJson) }))

		const res = await analyzeWithLlamaCpp("test code")
		expect(res.suggestions).toContain("Test suggestion")
	})

	test("validates analysis structure", async () => {
		const mockJson = {
			choices: [
				{
					message: {
						content: '{"invalid":"structure"}',
					},
				},
			],
		}
		vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve(mockJson) }))

		const res = await analyzeWithLlamaCpp("test code")
		expect(res.issues).toBeDefined()
		expect(Array.isArray(res.suggestions)).toBe(true)
	})
})

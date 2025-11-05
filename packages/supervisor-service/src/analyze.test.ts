import { describe, test, expect, beforeEach, vi } from "vitest"
import { Request, Response } from "express"
import { analyzeCode, healthCheck } from "./analyze.js"

vi.mock("./config.js", () => ({
	loadConfig: vi.fn(),
	getConfig: vi.fn().mockReturnValue({
		bind: "127.0.0.1",
		port: 9611,
		provider: "ollama",
		model: "llama3.1:8b-instruct-q4",
		max_tokens: 768,
		temperature: 0.2,
		autoFixWhitelist: ["path_not_found", "missing_dep", "flaky_test_rerun"],
		autoFixMinConfidence: 0.75,
		reflexion: { enabled: true, maxItems: 128, ttlDays: 60 },
	}),
	resetConfig: vi.fn(),
}))

// Mock Express Response
const mockResponse = () => {
	const res: Partial<Response> = {}
	res.status = vi.fn().mockReturnValue(res)
	res.json = vi.fn().mockReturnValue(res)
	return res as Response
}

describe("analyze", () => {
	beforeEach(() => {
		vi.clearAllMocks()
	})

	test("should return 400 for missing code", async () => {
		const req = { body: {} } as Request
		const res = mockResponse()

		await analyzeCode(req, res)

		expect(res.status).toHaveBeenCalledWith(400)
		expect(res.json).toHaveBeenCalledWith({
			error: "Invalid request: code is required and must be a string",
		})
	})

	test("should return 400 for invalid code type", async () => {
		const req = { body: { code: 123 } } as Request
		const res = mockResponse()

		await analyzeCode(req, res)

		expect(res.status).toHaveBeenCalledWith(400)
		expect(res.json).toHaveBeenCalledWith({
			error: "Invalid request: code is required and must be a string",
		})
	})

	test("should return analysis response for valid code", async () => {
		const req = {
			body: {
				code: 'console.log("hello world");',
				language: "javascript",
				filePath: "test.js",
				context: "Testing console output",
			},
		} as Request

		const res = mockResponse()

		await analyzeCode(req, res)

		expect(res.status).not.toHaveBeenCalled()
		expect(res.json).toHaveBeenCalledWith(
			expect.objectContaining({
				analysis: expect.objectContaining({
					issues: expect.any(Array),
					suggestions: expect.any(Array),
					fixedCode: expect.any(String),
				}),
				metadata: expect.objectContaining({
					model: expect.any(String),
					provider: expect.any(String),
					tokensUsed: expect.any(Number),
					processingTime: expect.any(Number),
				}),
			}),
		)
	})

	test("should handle analysis errors gracefully", async () => {
		const { getConfig } = await import("./config.js")
		vi.mocked(getConfig).mockImplementationOnce(() => {
			throw new Error("Config error")
		})

		const req = {
			body: { code: "valid code" },
		} as Request

		const res = mockResponse()

		await analyzeCode(req, res)

		expect(res.status).toHaveBeenCalledWith(500)
		expect(res.json).toHaveBeenCalledWith({
			error: "Internal server error during analysis",
			details: "Config error",
		})
	})
})

describe("healthCheck", () => {
	beforeEach(() => {
		vi.clearAllMocks()
	})

	test("should return healthy status", async () => {
		const req = {} as Request
		const res = mockResponse()

		await healthCheck(req, res)

		expect(res.status).not.toHaveBeenCalled()
		expect(res.json).toHaveBeenCalledWith(
			expect.objectContaining({
				status: "healthy",
				service: "kilocode-supervisor-service",
				version: "0.0.0",
				config: expect.objectContaining({
					provider: expect.any(String),
					model: expect.any(String),
					bind: expect.any(String),
					port: expect.any(Number),
				}),
			}),
		)
	})

	test("should return unhealthy status on error", async () => {
		const { getConfig } = await import("./config.js")
		vi.mocked(getConfig).mockImplementationOnce(() => {
			throw new Error("Config error")
		})

		const req = {} as Request
		const res = mockResponse()

		await healthCheck(req, res)

		expect(res.status).toHaveBeenCalledWith(500)
		expect(res.json).toHaveBeenCalledWith({
			status: "unhealthy",
			error: "Config error",
		})
	})
})

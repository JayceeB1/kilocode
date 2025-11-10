import request from "supertest"
import { createServerApp } from "../index.js"
import { z } from "zod"

describe("supervisor-service integration", () => {
	const cfg = {
		bind: "127.0.0.1",
		port: 9611,
		allowLAN: false,
		allowedLANs: ["10.0.4.0/24"],
		provider: "ollama",
		endpoint: "http://127.0.0.1:11434",
		autoLaunch: false,
		redactLog: true,
		model: "llama3.1:8b-instruct-q4",
		max_tokens: 768,
		temperature: 0.2,
		autoFixWhitelist: ["path_not_found", "missing_dep", "flaky_test_rerun"],
		autoFixMinConfidence: 0.75,
		reflexion: {
			enabled: true,
			maxItems: 128,
			ttlDays: 60,
		},
	}
	const app = createServerApp(cfg as any)

	it("GET /health → 200", async () => {
		const res = await request(app).get("/health")
		expect(res.status).toBe(200)
		expect(res.body?.status || res.text).toBeTruthy()
	})

	it("POST /v1/analyze without code → 400", async () => {
		const res = await request(app).post("/v1/analyze").send({})
		expect([400, 422]).toContain(res.status)
	})

	it("POST /v1/analyze with code → 200", async () => {
		const res = await request(app).post("/v1/analyze").send({ code: "const a=1" })
		expect(res.status).toBe(200)
		expect(res.body).toHaveProperty("analysis")
		expect(res.body.analysis).toHaveProperty("issues")
		expect(res.body.analysis).toHaveProperty("suggestions")
		expect(Array.isArray(res.body.analysis.issues)).toBe(true)
		expect(Array.isArray(res.body.analysis.suggestions)).toBe(true)
	})

	it("POST /v1/patch without required fields → 400", async () => {
		const res = await request(app).post("/v1/patch").send({})
		expect([400, 422]).toContain(res.status)
	})

	it("POST /v1/patch with valid data → 200", async () => {
		const patchData = {
			plan: {
				id: "test-patch-1",
				ops: [
					{
						id: "op-1",
						type: "search_replace",
						filePath: "/test/file.js",
						search: "const a = 1;",
						replace: "const a = 2;",
					},
				],
			},
			dryRun: true,
		}
		const res = await request(app).post("/v1/patch").send(patchData)
		expect(res.status).toBe(200)
		expect(res.body).toHaveProperty("result")
		expect(res.body).toHaveProperty("envelope")
		expect(res.body).toHaveProperty("dryRun", true)
	})

	it("CORS headers are present", async () => {
		const res = await request(app).get("/health").set("Origin", "http://localhost:3000")
		expect(res.headers).toHaveProperty("access-control-allow-origin")
	})

	it("Invalid route returns 404", async () => {
		const res = await request(app).get("/invalid-route")
		expect(res.status).toBe(404)
		expect(res.body).toHaveProperty("error", "Not Found")
		expect(res.body).toHaveProperty("availableRoutes")
	})

	it("Request logging middleware works", async () => {
		// This test verifies that the logging middleware doesn't break requests
		const res = await request(app).get("/health")
		expect(res.status).toBe(200)
	})

	it("CORS with localhost origins", async () => {
		const origins = ["http://localhost:3000", "http://127.0.0.1:3000"]
		for (const origin of origins) {
			const res = await request(app).get("/health").set("Origin", origin)
			expect(res.headers).toHaveProperty("access-control-allow-origin")
		}
	})

	it("CORS rejects non-localhost origins when allowLAN is false", async () => {
		const res = await request(app).get("/health").set("Origin", "http://evil.com")
		// CORS should not allow this origin
		expect(res.headers["access-control-allow-origin"]).not.toBe("http://evil.com")
	})

	it("CORS allows LAN origins when allowLAN is true", async () => {
		const lanCfg = { ...cfg, allowLAN: true }
		const lanApp = createServerApp(lanCfg as any)

		const res = await request(lanApp).get("/health").set("Origin", "http://10.0.4.100:3000")
		expect(res.headers).toHaveProperty("access-control-allow-origin")
	})
})

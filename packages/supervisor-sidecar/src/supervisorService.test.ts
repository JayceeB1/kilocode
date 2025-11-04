import { describe, test, expect, beforeEach, vi } from "vitest"
import { SupervisorService } from "./supervisorService"
import axios from "axios"

// Mock vscode
vi.mock("vscode", () => ({
	workspace: {
		getConfiguration: vi.fn(() => ({
			get: vi.fn((key: string, defaultValue: unknown) => {
				if (key === "serviceUrl") return "http://localhost:43110"
				return defaultValue
			}),
		})),
		onDidChangeConfiguration: vi.fn(),
	},
}))

// Mock axios
vi.mock("axios", () => ({
	default: {
		create: vi.fn(),
		get: vi.fn(),
		post: vi.fn(),
		put: vi.fn(),
		delete: vi.fn(),
		patch: vi.fn(),
		head: vi.fn(),
		options: vi.fn(),
		request: vi.fn(),
		getUri: vi.fn(),
		interceptors: {
			request: { use: vi.fn(), eject: vi.fn(), clear: vi.fn() },
			response: { use: vi.fn(), eject: vi.fn(), clear: vi.fn() },
		},
		defaults: {},
		isAxiosError: vi.fn(),
	},
}))

describe("SupervisorService", () => {
	let service: SupervisorService

	beforeEach(() => {
		vi.clearAllMocks()
		service = new SupervisorService()
	})

	test("should initialize with correct service URL", () => {
		expect(service["serviceUrl"]).toBe("http://localhost:43110")
	})

	test("should test connection successfully", async () => {
		const mockAxios = vi.mocked(axios) as unknown as {
			create: ReturnType<typeof vi.fn>
		}

		mockAxios.create.mockReturnValue({
			get: vi.fn().mockResolvedValue({
				data: {
					status: "healthy",
					service: "kilocode-supervisor-service",
					version: "0.0.0",
					config: {
						provider: "ollama",
						model: "llama3.1:8b-instruct-q4",
						bind: "127.0.0.1",
						port: 43110,
					},
				},
			}),
		})

		const newService = new SupervisorService()
		const result = await newService.testConnection()

		expect(result.success).toBe(true)
		expect(result.message).toContain("Connected to kilocode-supervisor-service")
	})

	test("should handle connection failure", async () => {
		const mockAxios = vi.mocked(axios) as unknown as {
			create: ReturnType<typeof vi.fn>
		}

		// Create a mock error with the code property
		const mockError = new Error("Connection refused") as Error & { code: string }
		mockError.code = "ECONNREFUSED"

		// Mock the client.get method to throw the error directly
		const mockGet = vi.fn().mockRejectedValue(mockError)

		mockAxios.create.mockReturnValue({
			get: mockGet,
		})

		// Mock isAxiosError to return true for our error
		const mockAxiosFull = vi.mocked(axios) as unknown as {
			isAxiosError: ReturnType<typeof vi.fn>
		}
		mockAxiosFull.isAxiosError.mockReturnValue(true)

		const newService = new SupervisorService()

		// Access the private client property to directly mock its get method
		const client = (newService as unknown as { client: { get: ReturnType<typeof vi.fn> } }).client
		client.get = mockGet

		const result = await newService.testConnection()

		expect(result.success).toBe(false)
		expect(result.message).toContain("Failed to get service info")
	})
})

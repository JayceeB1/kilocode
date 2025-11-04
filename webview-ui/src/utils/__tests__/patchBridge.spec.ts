import { describe, test, expect, vi, beforeEach } from "vitest"
import { vscode } from "../vscode"
import {
	reportEditError,
	reportPatchResult,
	createErrorPayload,
	createPatchResultPayload,
	PatchOutcome,
	PatchClassification,
	type PatchResult,
} from "../patchBridge"

// Mock vscode module
vi.mock("../vscode")

describe("patchBridge", () => {
	beforeEach(() => {
		vi.clearAllMocks()
		// Reset mock implementation to default (no error)
		vi.mocked(vscode).postMessage.mockImplementation(() => {})
	})

	describe("reportEditError", () => {
		test("should post error message with correct type and payload", () => {
			const errorPayload = { message: "Test error", code: 500 }

			reportEditError(errorPayload)

			expect(vi.mocked(vscode).postMessage).toHaveBeenCalledWith({
				type: "supervisor:error",
				payload: errorPayload,
			})
		})

		test("should handle postMessage errors", () => {
			const errorMessage = "PostMessage failed"
			vi.mocked(vscode).postMessage.mockImplementation(() => {
				throw new Error(errorMessage)
			})

			expect(() => reportEditError({ message: "Test" })).toThrow(`Failed to report edit error: ${errorMessage}`)
		})
	})

	describe("reportPatchResult", () => {
		test("should post patch result with correct type and payload", () => {
			const result: PatchResult = {
				opId: "test-op-123",
				outcome: PatchOutcome.SUCCESS,
				classification: PatchClassification.BUGFIX,
				executionTimeMs: 150,
			}

			reportPatchResult(result)

			expect(vi.mocked(vscode).postMessage).toHaveBeenCalledWith({
				type: "supervisor:result",
				payload: result,
			})
		})

		test("should handle postMessage errors", () => {
			const errorMessage = "PostMessage failed"
			vi.mocked(vscode).postMessage.mockImplementation(() => {
				throw new Error(errorMessage)
			})

			const result: PatchResult = {
				opId: "test-op-123",
				outcome: PatchOutcome.FAILURE,
				classification: PatchClassification.OTHER,
			}

			expect(() => reportPatchResult(result)).toThrow(`Failed to report patch result: ${errorMessage}`)
		})
	})

	describe("createErrorPayload", () => {
		test("should create error payload with message, stack, and timestamp", () => {
			const error = new Error("Test error message")
			error.stack = "Error: Test error message\n    at test.js:1:1"

			const payload = createErrorPayload(error)

			expect(payload).toEqual({
				message: "Test error message",
				stack: "Error: Test error message\n    at test.js:1:1",
				context: {},
				timestamp: expect.any(String),
			})

			// Verify timestamp is a valid ISO string
			expect(new Date(payload.timestamp)).toBeInstanceOf(Date)
		})

		test("should include context when provided", () => {
			const error = new Error("Test error")
			const context = { operation: "test", filePath: "/test/file.ts" }

			const payload = createErrorPayload(error, context)

			expect(payload.context).toEqual(context)
		})

		test("should handle errors without stack trace", () => {
			const error = new Error("Test error")
			delete error.stack

			const payload = createErrorPayload(error)

			expect(payload.message).toBe("Test error")
			expect(payload.stack).toBeUndefined()
		})
	})

	describe("createPatchResultPayload", () => {
		test("should create patch result payload with result data and timestamp", () => {
			const result: PatchResult = {
				opId: "test-op-456",
				outcome: PatchOutcome.SUCCESS,
				classification: PatchClassification.FEATURE,
				modifiedLines: [10, 11, 12],
				executionTimeMs: 200,
			}

			const payload = createPatchResultPayload(result)

			expect(payload).toEqual({
				...result,
				context: {},
				timestamp: expect.any(String),
			})

			// Verify timestamp is a valid ISO string
			expect(new Date(payload.timestamp)).toBeInstanceOf(Date)
		})

		test("should include context when provided", () => {
			const result: PatchResult = {
				opId: "test-op-789",
				outcome: PatchOutcome.PARTIAL,
				classification: PatchClassification.REFACTOR,
			}
			const context = { userIntent: "Refactor function", relatedFiles: ["helper.ts"] }

			const payload = createPatchResultPayload(result, context)

			expect(payload.context).toEqual(context)
			expect(payload.opId).toBe(result.opId)
			expect(payload.outcome).toBe(result.outcome)
			expect(payload.classification).toBe(result.classification)
		})
	})
})

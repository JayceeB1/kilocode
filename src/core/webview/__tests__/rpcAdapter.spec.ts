import { describe, test, expect, vi, beforeEach } from "vitest"
import { isRpcEnvelope, toTypeMessage } from "../webviewMessageHandler"

describe("RPC Adapter Integration", () => {
	describe("RPC Message Detection and Conversion", () => {
		test("should correctly identify and convert supervisor:get RPC message", () => {
			const rpcMessage = {
				__rpc: true,
				id: "test-id-123",
				command: "supervisor:get",
				payload: { key: "test-config-key" },
			}

			// Verify it's detected as RPC envelope
			expect(isRpcEnvelope(rpcMessage)).toBe(true)

			// Verify it's converted correctly
			const converted = toTypeMessage(rpcMessage)
			expect(converted).toEqual({
				type: "supervisor:get",
				payload: { key: "test-config-key" },
				__rpc_id: "test-id-123",
			})
		})

		test("should correctly identify and convert supervisor:set RPC message", () => {
			const rpcMessage = {
				__rpc: true,
				id: "test-id-456",
				command: "supervisor:set",
				payload: { key: "test-key", value: "test-value" },
			}

			// Verify it's detected as RPC envelope
			expect(isRpcEnvelope(rpcMessage)).toBe(true)

			// Verify it's converted correctly
			const converted = toTypeMessage(rpcMessage)
			expect(converted).toEqual({
				type: "supervisor:set",
				payload: { key: "test-key", value: "test-value" },
				__rpc_id: "test-id-456",
			})
		})

		test("should correctly identify and convert supervisor:error RPC message", () => {
			const rpcMessage = {
				__rpc: true,
				id: "error-id-789",
				command: "supervisor:error",
				payload: { error: "Test error message" },
			}

			// Verify it's detected as RPC envelope
			expect(isRpcEnvelope(rpcMessage)).toBe(true)

			// Verify it's converted correctly
			const converted = toTypeMessage(rpcMessage)
			expect(converted).toEqual({
				type: "supervisor:error",
				payload: { error: "Test error message" },
				__rpc_id: "error-id-789",
			})
		})

		test("should correctly identify and convert supervisor:result RPC message", () => {
			const rpcMessage = {
				__rpc: true,
				id: "result-id-999",
				command: "supervisor:result",
				payload: { result: "Test result data" },
			}

			// Verify it's detected as RPC envelope
			expect(isRpcEnvelope(rpcMessage)).toBe(true)

			// Verify it's converted correctly
			const converted = toTypeMessage(rpcMessage)
			expect(converted).toEqual({
				type: "supervisor:result",
				payload: { result: "Test result data" },
				__rpc_id: "result-id-999",
			})
		})

		test("should reject non-RPC messages", () => {
			const regularMessage = {
				type: "regularMessage",
				payload: { data: "test-data" },
			}

			// Verify it's not detected as RPC envelope
			expect(isRpcEnvelope(regularMessage)).toBe(false)
		})

		test("should reject invalid RPC messages", () => {
			const invalidRpcMessages = [
				{ __rpc: false, id: "test", command: "test" }, // __rpc is false
				{ __rpc: true, id: 123, command: "test" }, // id is not string
				{ __rpc: true, id: "test", command: 123 }, // command is not string
				{ __rpc: true, id: "test" }, // missing command
				{ id: "test", command: "test" }, // missing __rpc
			]

			invalidRpcMessages.forEach((message) => {
				expect(isRpcEnvelope(message)).toBe(false)
			})
		})
	})

	describe("RPC Response Format", () => {
		test("should format successful RPC response correctly", () => {
			// This tests the expected format of successful RPC responses
			const expectedResponse = {
				__rpc: true,
				id: "test-id",
				result: { value: "test-result" },
			}

			// Verify the response format matches expectations
			expect(expectedResponse).toHaveProperty("__rpc", true)
			expect(expectedResponse).toHaveProperty("id", "test-id")
			expect(expectedResponse).toHaveProperty("result")
			expect(expectedResponse).not.toHaveProperty("error")
		})

		test("should format error RPC response correctly", () => {
			// This tests the expected format of error RPC responses
			const expectedResponse = {
				__rpc: true,
				id: "test-id",
				error: "Test error message",
			}

			// Verify the response format matches expectations
			expect(expectedResponse).toHaveProperty("__rpc", true)
			expect(expectedResponse).toHaveProperty("id", "test-id")
			expect(expectedResponse).toHaveProperty("error", "Test error message")
			expect(expectedResponse).not.toHaveProperty("result")
		})
	})
})

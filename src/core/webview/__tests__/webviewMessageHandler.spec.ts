import { describe, test, expect, vi, beforeEach } from "vitest"
import { isRpcEnvelope, toTypeMessage } from "../webviewMessageHandler"

describe("webviewMessageHandler RPC Adapter", () => {
	describe("RPC Helper Functions", () => {
		test("isRpcEnvelope should correctly identify RPC messages", () => {
			const rpcMessage = {
				__rpc: true as const,
				id: "test-id",
				command: "supervisor:get",
				payload: { key: "test-key" },
			}

			expect(isRpcEnvelope(rpcMessage)).toBe(true)
		})

		test("isRpcEnvelope should reject non-RPC messages", () => {
			const regularMessage = {
				type: "regularMessage",
				payload: { data: "test-data" },
			}

			expect(isRpcEnvelope(regularMessage)).toBe(false)
		})

		test("isRpcEnvelope should reject invalid RPC messages", () => {
			const invalidRpcMessage1 = {
				__rpc: true as const,
				id: 123, // Should be string
				command: "test",
			}

			const invalidRpcMessage2 = {
				__rpc: true as const,
				id: "test-id",
				command: 123, // Should be string
			}

			const invalidRpcMessage3 = {
				__rpc: false, // Should be true
				id: "test-id",
				command: "test",
			}

			expect(isRpcEnvelope(invalidRpcMessage1)).toBe(false)
			expect(isRpcEnvelope(invalidRpcMessage2)).toBe(false)
			expect(isRpcEnvelope(invalidRpcMessage3)).toBe(false)
		})

		test("toTypeMessage should convert RPC envelope to internal format", () => {
			const rpcMessage = {
				__rpc: true as const,
				id: "test-id",
				command: "supervisor:get",
				payload: { key: "test-key" },
			}

			const converted = toTypeMessage(rpcMessage)

			expect(converted).toEqual({
				type: "supervisor:get",
				payload: { key: "test-key" },
				__rpc_id: "test-id",
			})
		})
	})
})

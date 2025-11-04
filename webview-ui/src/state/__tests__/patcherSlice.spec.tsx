import React from "react"
import { render, act, fireEvent } from "@testing-library/react"
import { describe, it, expect, beforeEach, vi } from "vitest"
import {
	PatcherChatProvider,
	usePatcherChat,
	createPatcherEvent,
	isSuccessfulEvent,
	isErrorEvent,
	type PatcherEvent,
	type PatcherClassification,
} from "../patcherSlice"

// Mock console.error to avoid test output noise
vi.mock("../../../utils/vscode", () => ({
	vscode: {
		postMessage: vi.fn(),
	},
}))

describe("patcherSlice", () => {
	let TestComponent: React.FC<{ onStateUpdate?: (state: any) => void }>

	beforeEach(() => {
		// Reset all mocks before each test
		vi.clearAllMocks()

		// Create a test component that uses the hook
		TestComponent = ({ onStateUpdate }) => {
			// eslint-disable-next-line @typescript-eslint/no-unused-vars
			const { state, addOrUpdateEvent, clearEvents, getEvent } = usePatcherChat()

			// Call the callback with the current state for testing
			React.useEffect(() => {
				onStateUpdate?.(state)
			}, [state, onStateUpdate])

			return <div data-testid="test-component">Test Component</div>
		}
	})

	describe("PatcherChatProvider", () => {
		it("should provide initial state with empty events map", () => {
			let capturedState: any

			render(
				<PatcherChatProvider>
					<TestComponent
						onStateUpdate={(state) => {
							capturedState = state
						}}
					/>
				</PatcherChatProvider>,
			)

			expect(capturedState).toEqual({ events: {} })
		})

		it("should handle supervisor:patcherEvent messages", () => {
			let capturedState: any

			render(
				<PatcherChatProvider>
					<TestComponent
						onStateUpdate={(state) => {
							capturedState = state
						}}
					/>
				</PatcherChatProvider>,
			)

			// Simulate a supervisor:patcherEvent message
			const patcherMessage = {
				type: "supervisor:patcherEvent",
				messageId: "test-message-123",
				classification: "applied" as PatcherClassification,
				file: "/path/to/test.ts",
				error: undefined,
				suggestedPlan: undefined,
			}

			act(() => {
				fireEvent(window, new MessageEvent("message", { data: patcherMessage }))
			})

			expect(capturedState.events["test-message-123"]).toBeDefined()
			expect(capturedState.events["test-message-123"].messageId).toBe("test-message-123")
			expect(capturedState.events["test-message-123"].classification).toBe("applied")
			expect(capturedState.events["test-message-123"].file).toBe("/path/to/test.ts")
			expect(capturedState.events["test-message-123"].ts).toBeTypeOf("number")
		})

		it("should handle supervisor:patcherEvent messages with error", () => {
			let capturedState: any

			render(
				<PatcherChatProvider>
					<TestComponent
						onStateUpdate={(state) => {
							capturedState = state
						}}
					/>
				</PatcherChatProvider>,
			)

			// Simulate a supervisor:patcherEvent message with error
			const patcherMessage = {
				type: "supervisor:patcherEvent",
				messageId: "test-message-456",
				classification: "anchor_mismatch" as PatcherClassification,
				file: "/path/to/test.ts",
				error: "Anchor mismatch error",
				suggestedPlan: { action: "retry" },
			}

			act(() => {
				fireEvent(window, new MessageEvent("message", { data: patcherMessage }))
			})

			expect(capturedState.events["test-message-456"]).toBeDefined()
			expect(capturedState.events["test-message-456"].error).toBe("Anchor mismatch error")
			expect(capturedState.events["test-message-456"].suggestedPlan).toEqual({ action: "retry" })
		})

		it("should ignore non-supervisor:patcherEvent messages", () => {
			let capturedState: any

			render(
				<PatcherChatProvider>
					<TestComponent
						onStateUpdate={(state) => {
							capturedState = state
						}}
					/>
				</PatcherChatProvider>,
			)

			// Simulate a different message type
			const otherMessage = {
				type: "other:message",
				data: "should be ignored",
			}

			act(() => {
				fireEvent(window, new MessageEvent("message", { data: otherMessage }))
			})

			// State should remain unchanged
			expect(capturedState).toEqual({ events: {} })
		})

		it("should handle malformed messages gracefully", () => {
			const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {})

			render(
				<PatcherChatProvider>
					<TestComponent />
				</PatcherChatProvider>,
			)

			// Simulate a malformed message
			const malformedMessage = {
				type: "supervisor:patcherEvent",
				// Missing required fields
			}

			act(() => {
				fireEvent(window, new MessageEvent("message", { data: malformedMessage }))
			})

			// Should log an error but not crash
			expect(consoleSpy).toHaveBeenCalledWith(
				"Failed to process supervisor:patcherEvent message:",
				expect.any(Error),
			)

			consoleSpy.mockRestore()
		})
	})

	describe("usePatcherChat", () => {
		it("should provide addOrUpdateEvent function", () => {
			let capturedFunctions: any

			const TestComponentWithFunctions = () => {
				const { addOrUpdateEvent, clearEvents, getEvent } = usePatcherChat()
				capturedFunctions = { addOrUpdateEvent, clearEvents, getEvent }
				return <div data-testid="test-component">Test Component</div>
			}

			render(
				<PatcherChatProvider>
					<TestComponentWithFunctions />
				</PatcherChatProvider>,
			)

			expect(capturedFunctions.addOrUpdateEvent).toBeTypeOf("function")
			expect(capturedFunctions.clearEvents).toBeTypeOf("function")
			expect(capturedFunctions.getEvent).toBeTypeOf("function")
		})
	})

	describe("addOrUpdateEvent", () => {
		it("should add new event to state", () => {
			let capturedState: any
			let capturedFunctions: any

			const TestComponentWithFunctions = () => {
				const { state, addOrUpdateEvent } = usePatcherChat()
				capturedState = state
				capturedFunctions = { addOrUpdateEvent }
				return <div data-testid="test-component">Test Component</div>
			}

			render(
				<PatcherChatProvider>
					<TestComponentWithFunctions />
				</PatcherChatProvider>,
			)

			const testEvent: PatcherEvent = {
				messageId: "test-123",
				classification: "applied",
				file: "/test/file.ts",
				ts: Date.now(),
			}

			act(() => {
				capturedFunctions.addOrUpdateEvent(testEvent)
			})

			expect(capturedState.events["test-123"]).toEqual(testEvent)
		})

		it("should update existing event in state", () => {
			let capturedState: any
			let capturedFunctions: any

			const TestComponentWithFunctions = () => {
				const { state, addOrUpdateEvent } = usePatcherChat()
				capturedState = state
				capturedFunctions = { addOrUpdateEvent }
				return <div data-testid="test-component">Test Component</div>
			}

			render(
				<PatcherChatProvider>
					<TestComponentWithFunctions />
				</PatcherChatProvider>,
			)

			const initialEvent: PatcherEvent = {
				messageId: "test-123",
				classification: "applied",
				file: "/test/file.ts",
				ts: 1000,
			}

			const updatedEvent: PatcherEvent = {
				messageId: "test-123",
				classification: "lint_error",
				file: "/test/file.ts",
				error: "Lint error occurred",
				ts: 2000,
			}

			// Add initial event
			act(() => {
				capturedFunctions.addOrUpdateEvent(initialEvent)
			})

			// Update the event
			act(() => {
				capturedFunctions.addOrUpdateEvent(updatedEvent)
			})

			expect(capturedState.events["test-123"]).toEqual(updatedEvent)
			expect(capturedState.events["test-123"].classification).toBe("lint_error")
			expect(capturedState.events["test-123"].error).toBe("Lint error occurred")
		})
	})

	describe("clearEvents", () => {
		it("should clear all events from state", () => {
			let capturedState: any
			let capturedFunctions: any

			const TestComponentWithFunctions = () => {
				const { state, addOrUpdateEvent, clearEvents } = usePatcherChat()
				capturedState = state
				capturedFunctions = { addOrUpdateEvent, clearEvents }
				return <div data-testid="test-component">Test Component</div>
			}

			render(
				<PatcherChatProvider>
					<TestComponentWithFunctions />
				</PatcherChatProvider>,
			)

			// Add some events
			const testEvent1: PatcherEvent = {
				messageId: "test-123",
				classification: "applied",
				ts: Date.now(),
			}

			const testEvent2: PatcherEvent = {
				messageId: "test-456",
				classification: "noop",
				ts: Date.now(),
			}

			act(() => {
				capturedFunctions.addOrUpdateEvent(testEvent1)
				capturedFunctions.addOrUpdateEvent(testEvent2)
			})

			expect(Object.keys(capturedState.events)).toHaveLength(2)

			// Clear all events
			act(() => {
				capturedFunctions.clearEvents()
			})

			expect(capturedState.events).toEqual({})
		})
	})

	describe("getEvent", () => {
		it("should return the correct event for given messageId", () => {
			let capturedFunctions: any

			const TestComponentWithFunctions = () => {
				const { addOrUpdateEvent, getEvent } = usePatcherChat()
				capturedFunctions = { addOrUpdateEvent, getEvent }
				return <div data-testid="test-component">Test Component</div>
			}

			render(
				<PatcherChatProvider>
					<TestComponentWithFunctions />
				</PatcherChatProvider>,
			)

			const testEvent: PatcherEvent = {
				messageId: "test-123",
				classification: "applied",
				file: "/test/file.ts",
				ts: Date.now(),
			}

			act(() => {
				capturedFunctions.addOrUpdateEvent(testEvent)
			})

			const retrievedEvent = capturedFunctions.getEvent("test-123")
			expect(retrievedEvent).toEqual(testEvent)

			const nonExistentEvent = capturedFunctions.getEvent("non-existent")
			expect(nonExistentEvent).toBeUndefined()
		})
	})

	describe("utility functions", () => {
		describe("createPatcherEvent", () => {
			it("should create a properly formatted patcher event", () => {
				const event = createPatcherEvent("msg-123", "applied", "/path/to/file.ts", undefined, {
					action: "retry",
				})

				expect(event).toEqual({
					messageId: "msg-123",
					classification: "applied",
					file: "/path/to/file.ts",
					error: undefined,
					suggestedPlan: { action: "retry" },
					ts: expect.any(Number),
				})
			})

			it("should create event with minimal parameters", () => {
				const event = createPatcherEvent("msg-456", "noop")

				expect(event).toEqual({
					messageId: "msg-456",
					classification: "noop",
					file: undefined,
					error: undefined,
					suggestedPlan: undefined,
					ts: expect.any(Number),
				})
			})
		})

		describe("isSuccessfulEvent", () => {
			it("should return true for applied events", () => {
				const event: PatcherEvent = {
					messageId: "test-123",
					classification: "applied",
					ts: Date.now(),
				}

				expect(isSuccessfulEvent(event)).toBe(true)
			})

			it("should return false for non-applied events", () => {
				const event: PatcherEvent = {
					messageId: "test-123",
					classification: "lint_error",
					ts: Date.now(),
				}

				expect(isSuccessfulEvent(event)).toBe(false)
			})
		})

		describe("isErrorEvent", () => {
			it("should return true for error classifications", () => {
				const errorEvents: PatcherClassification[] = ["anchor_mismatch", "lint_error", "type_error"]

				errorEvents.forEach((classification) => {
					const event: PatcherEvent = {
						messageId: "test-123",
						classification,
						ts: Date.now(),
					}

					expect(isErrorEvent(event)).toBe(true)
				})
			})

			it("should return true for events with error property", () => {
				const event: PatcherEvent = {
					messageId: "test-123",
					classification: "unknown",
					error: "Some error occurred",
					ts: Date.now(),
				}

				expect(isErrorEvent(event)).toBe(true)
			})

			it("should return false for successful events without error", () => {
				const event: PatcherEvent = {
					messageId: "test-123",
					classification: "applied",
					ts: Date.now(),
				}

				expect(isErrorEvent(event)).toBe(false)
			})
		})
	})
})

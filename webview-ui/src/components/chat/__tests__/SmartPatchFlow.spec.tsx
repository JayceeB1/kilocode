import React from "react"
import { render, screen, fireEvent, waitFor } from "@testing-library/react"
import { describe, it, expect, vi, beforeEach } from "vitest"
import { PatcherChatProvider, usePatcherChat } from "@src/state/patcherSlice"
import SmartPatchMessage from "../SmartPatchMessage"

// Mock fetch for funny messages
const mockFetch = vi.fn()
global.fetch = mockFetch

// Mock window.postMessage
const mockPostMessage = vi.fn()
Object.defineProperty(window, "postMessage", {
	value: mockPostMessage,
	writable: true,
})

// Test wrapper component
const TestWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
	<PatcherChatProvider>{children}</PatcherChatProvider>
)

describe("Smart Patch Flow", () => {
	const mockEvent = {
		messageId: "test-message-123",
		classification: "lint_error" as const,
		file: "/path/to/file.ts",
		error: "Syntax error: Unexpected token",
		suggestedPlan: undefined,
		ts: Date.now(),
	}

	const mockFunnyMessages = {
		version: 1,
		maxPerClass: 20,
		messages: {
			lint_error: [
				"Oops! Your code has a syntax hiccup. Let's patch that up!",
				"Looks like your code forgot its grammar lessons. Smart Patcher to the rescue!",
			],
		},
	}

	beforeEach(() => {
		vi.clearAllMocks()

		// Mock fetch to return funny messages
		mockFetch.mockResolvedValueOnce({
			ok: true,
			json: async () => mockFunnyMessages,
		})
	})

	it("should render SmartPatchMessage with patcher event data", async () => {
		// Create a test component that adds event to context
		const TestComponent = () => {
			const { addOrUpdateEvent } = usePatcherChat()

			React.useEffect(() => {
				addOrUpdateEvent(mockEvent)
			}, [addOrUpdateEvent])

			return <SmartPatchMessage messageId="test-message-123" />
		}

		render(
			<TestWrapper>
				<TestComponent />
			</TestWrapper>,
		)

		// Wait for funny message to load
		await waitFor(() => {
			expect(screen.getByText(/syntax hiccup|grammar lessons/)).toBeInTheDocument()
		})

		// Check if the file path is displayed
		expect(screen.getByText(/\/path\/to\/file.ts/)).toBeInTheDocument()
	})

	it("should not render SmartPatchMessage when no patcher event exists", () => {
		render(
			<TestWrapper>
				<SmartPatchMessage messageId="nonexistent" />
			</TestWrapper>,
		)

		// The component should render null when no patcher event exists
		expect(screen.queryByText(/Smart Patcher/)).not.toBeInTheDocument()
	})

	it("should handle dry-run button click", async () => {
		const TestComponent = () => {
			const { addOrUpdateEvent } = usePatcherChat()

			React.useEffect(() => {
				addOrUpdateEvent(mockEvent)
			}, [addOrUpdateEvent])

			return <SmartPatchMessage messageId="test-message-123" />
		}

		render(
			<TestWrapper>
				<TestComponent />
			</TestWrapper>,
		)

		// Wait for component to load
		await waitFor(() => {
			expect(screen.getByText(/syntax hiccup|grammar lessons/)).toBeInTheDocument()
		})

		// Expand to see action buttons
		const header = screen.getByText(/syntax hiccup|grammar lessons/).closest("div")
		if (header) {
			fireEvent.click(header)
		}

		// Wait for buttons to appear
		await waitFor(() => {
			expect(screen.getByText("Dry-run")).toBeInTheDocument()
		})

		// Click Dry-run button
		const dryRunButton = screen.getByText("Dry-run")
		fireEvent.click(dryRunButton)

		expect(mockPostMessage).toHaveBeenCalledWith({ type: "patcher:run", mode: "dry" })
	})

	it("should handle open plan button click", async () => {
		const TestComponent = () => {
			const { addOrUpdateEvent } = usePatcherChat()

			React.useEffect(() => {
				addOrUpdateEvent(mockEvent)
			}, [addOrUpdateEvent])

			return <SmartPatchMessage messageId="test-message-123" />
		}

		render(
			<TestWrapper>
				<TestComponent />
			</TestWrapper>,
		)

		// Wait for component to load
		await waitFor(() => {
			expect(screen.getByText(/syntax hiccup|grammar lessons/)).toBeInTheDocument()
		})

		// Expand to see action buttons
		const header = screen.getByText(/syntax hiccup|grammar lessons/).closest("div")
		if (header) {
			fireEvent.click(header)
		}

		// Wait for buttons to appear
		await waitFor(() => {
			expect(screen.getByText("Open plan")).toBeInTheDocument()
		})

		// Click Open plan button
		const openPlanButton = screen.getByText("Open plan")
		fireEvent.click(openPlanButton)

		expect(mockPostMessage).toHaveBeenCalledWith({ type: "patcher:openPlan" })
	})
})

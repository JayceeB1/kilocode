import React from "react"
import { render, screen, fireEvent, waitFor } from "@testing-library/react"
import { describe, it, expect, vi, beforeEach } from "vitest"
import SmartPatchMessage from "../SmartPatchMessage"
import { PatcherChatProvider, usePatcherChat } from "@src/state/patcherSlice"

// Mock fetch for funny messages
const mockFetch = vi.fn()
global.fetch = mockFetch

// Mock window.postMessage
const mockPostMessage = vi.fn()
Object.defineProperty(window, "postMessage", {
	value: mockPostMessage,
	writable: true,
})

describe("SmartPatchMessage", () => {
	const mockEvent = {
		messageId: "test-message-123",
		classification: "applied" as const,
		file: "/path/to/file.ts",
		error: undefined,
		suggestedPlan: {
			anchor: {
				after: "some code",
				before: "other code",
				insert: "insert code",
			},
		},
		ts: Date.now(),
	}

	const mockFunnyMessages = {
		version: 1,
		maxPerClass: 20,
		messages: {
			applied: ["Smart patcher to the rescue! 🛠️", "Patch applied. Code karma restored. ✔️"],
			unknown: ["Smart patcher reporting. 👋", "Odd case; keeping edits minimal. 🐛"],
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

	it("should render component with CPU icon and funny message", async () => {
		// Create a test wrapper that provides context
		const TestWrapper = ({ children }: { children: React.ReactNode }) => (
			<PatcherChatProvider>{children}</PatcherChatProvider>
		)

		// Create a test component that adds the event to context
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
			expect(screen.getByText(/Smart patcher to the rescue|Patch applied/)).toBeInTheDocument()
		})

		// Check for CPU icon (codicon-server-environment)
		const cpuIcon = document.querySelector(".codicon-server-environment")
		expect(cpuIcon).toBeInTheDocument()
	})

	it("should expand and collapse details when clicked", async () => {
		const TestWrapper = ({ children }: { children: React.ReactNode }) => (
			<PatcherChatProvider>{children}</PatcherChatProvider>
		)

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
			expect(screen.getByText(/Smart patcher to the rescue|Patch applied/)).toBeInTheDocument()
		})

		// Initially collapsed - details should not be visible
		expect(screen.queryByText("Classification:")).not.toBeInTheDocument()

		// Click to expand
		const header = screen.getByText(/Smart patcher to the rescue|Patch applied/).closest("div")
		if (header) {
			fireEvent.click(header)
		}

		// Now expanded - details should be visible
		await waitFor(() => {
			expect(screen.getByText("Classification:")).toBeInTheDocument()
			expect(screen.getByText("applied")).toBeInTheDocument()
			expect(screen.getByText("File:")).toBeInTheDocument()
			expect(screen.getByText("/path/to/file.ts")).toBeInTheDocument()
		})
	})

	it("should send correct messages when action buttons are clicked", async () => {
		const TestWrapper = ({ children }: { children: React.ReactNode }) => (
			<PatcherChatProvider>{children}</PatcherChatProvider>
		)

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
			expect(screen.getByText(/Smart patcher to the rescue|Patch applied/)).toBeInTheDocument()
		})

		// Expand to see action buttons
		const header = screen.getByText(/Smart patcher to the rescue|Patch applied/).closest("div")
		if (header) {
			fireEvent.click(header)
		}

		// Wait for buttons to appear
		await waitFor(() => {
			expect(screen.getByText("Dry-run")).toBeInTheDocument()
			expect(screen.getByText("Open plan")).toBeInTheDocument()
		})

		// Click Dry-run button
		const dryRunButton = screen.getByText("Dry-run")
		fireEvent.click(dryRunButton)

		expect(mockPostMessage).toHaveBeenCalledWith({ type: "patcher:run", mode: "dry" })

		// Click Open plan button
		const openPlanButton = screen.getByText("Open plan")
		fireEvent.click(openPlanButton)

		expect(mockPostMessage).toHaveBeenCalledWith({ type: "patcher:openPlan" })
	})
})

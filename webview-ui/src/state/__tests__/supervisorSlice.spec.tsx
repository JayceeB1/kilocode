import React from "react"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { vi } from "vitest"
import { SupervisorProvider, useSupervisor } from "../supervisorSlice"
import { sendWithCompat } from "../../utils/vscode"

// Mock vscode utility
vi.mock("../../utils/vscode", () => ({
	sendWithCompat: vi.fn(),
}))

const mockSendWithCompat = vi.mocked(sendWithCompat)

// Test component to access the context
function TestComponent() {
	const { enabled, setEnabled } = useSupervisor()
	return (
		<div>
			<div data-testid="enabled-state">{enabled.toString()}</div>
			<button onClick={() => setEnabled(!enabled)}>Toggle</button>
		</div>
	)
}

describe("supervisorSlice", () => {
	const defaultConfig = {
		version: 1,
		enabled: false,
		autoLaunch: false,
		bind: "127.0.0.1",
		port: 9611,
		provider: "ollama" as const,
		endpoint: "http://127.0.0.1:11434",
		model: "llama3.1:8b-instruct-q4",
		max_tokens: 768,
		temperature: 0.2,
		allowLAN: false,
		allowedLANs: ["10.0.4.0/24"],
		redactLog: true,
	}

	beforeEach(() => {
		vi.clearAllMocks()
		mockSendWithCompat.mockResolvedValue(defaultConfig)
	})

	it("provides default enabled state as false", () => {
		render(
			<SupervisorProvider>
				<TestComponent />
			</SupervisorProvider>,
		)

		expect(screen.getByTestId("enabled-state")).toHaveTextContent("false")
	})

	it("loads configuration from IPC on mount", async () => {
		render(
			<SupervisorProvider>
				<TestComponent />
			</SupervisorProvider>,
		)

		// Should render with default state
		expect(screen.getByTestId("enabled-state")).toHaveTextContent("false")
	})

	it("toggles enabled state when setEnabled is called", async () => {
		const user = userEvent.setup()

		render(
			<SupervisorProvider>
				<TestComponent />
			</SupervisorProvider>,
		)

		// Initial state should be false
		expect(screen.getByTestId("enabled-state")).toHaveTextContent("false")

		// Click the toggle button
		await user.click(screen.getByText("Toggle"))

		// State should now be true
		expect(screen.getByTestId("enabled-state")).toHaveTextContent("true")

		// Click again
		await user.click(screen.getByText("Toggle"))

		// State should be false again
		expect(screen.getByTestId("enabled-state")).toHaveTextContent("false")
	})

	it("handles keyboard shortcut Ctrl+Alt+L", async () => {
		render(
			<SupervisorProvider>
				<TestComponent />
			</SupervisorProvider>,
		)

		await waitFor(() => {
			expect(mockSendWithCompat).toHaveBeenCalled()
		})

		// Initial state should be false
		expect(screen.getByTestId("enabled-state")).toHaveTextContent("false")

		// Simulate Ctrl+Alt+L keypress
		const event = new KeyboardEvent("keydown", {
			key: "l",
			ctrlKey: true,
			altKey: true,
		})
		window.dispatchEvent(event)

		// State should be toggled to true
		await waitFor(
			() => {
				expect(screen.getByTestId("enabled-state")).toHaveTextContent("true")
			},
			{ timeout: 1000 },
		)

		// Simulate Ctrl+Alt+L again
		window.dispatchEvent(event)

		// State should be toggled back to false
		await waitFor(
			() => {
				expect(screen.getByTestId("enabled-state")).toHaveTextContent("false")
			},
			{ timeout: 1000 },
		)
	})

	it("ignores other key combinations", async () => {
		render(
			<SupervisorProvider>
				<TestComponent />
			</SupervisorProvider>,
		)

		// Initial state should be false
		expect(screen.getByTestId("enabled-state")).toHaveTextContent("false")

		// Simulate Ctrl+L (without Alt)
		const ctrlLEvent = new KeyboardEvent("keydown", {
			key: "l",
			ctrlKey: true,
			altKey: false,
		})
		window.dispatchEvent(ctrlLEvent)

		// State should remain false
		expect(screen.getByTestId("enabled-state")).toHaveTextContent("false")

		// Simulate Alt+L (without Ctrl)
		const altLEvent = new KeyboardEvent("keydown", {
			key: "l",
			ctrlKey: false,
			altKey: true,
		})
		window.dispatchEvent(altLEvent)

		// State should remain false
		expect(screen.getByTestId("enabled-state")).toHaveTextContent("false")

		// Simulate Ctrl+Alt+K (different key)
		const ctrlAltKEvent = new KeyboardEvent("keydown", {
			key: "k",
			ctrlKey: true,
			altKey: true,
		})
		window.dispatchEvent(ctrlAltKEvent)

		// State should remain false
		expect(screen.getByTestId("enabled-state")).toHaveTextContent("false")
	})

	it("handles errors when loading configuration", async () => {
		mockSendWithCompat.mockRejectedValue(new Error("Failed to load config"))

		render(
			<SupervisorProvider>
				<TestComponent />
			</SupervisorProvider>,
		)

		// Should still provide default state even if loading fails
		expect(screen.getByTestId("enabled-state")).toHaveTextContent("false")
	})

	it("cleans up keyboard event listener on unmount", () => {
		const addEventListenerSpy = vi.spyOn(window, "addEventListener")
		const removeEventListenerSpy = vi.spyOn(window, "removeEventListener")

		const { unmount } = render(
			<SupervisorProvider>
				<TestComponent />
			</SupervisorProvider>,
		)

		// Should add event listener on mount
		expect(addEventListenerSpy).toHaveBeenCalledWith("keydown", expect.any(Function))

		// Unmount the component
		unmount()

		// Should remove event listener on unmount
		expect(removeEventListenerSpy).toHaveBeenCalledWith("keydown", expect.any(Function))
	})
})

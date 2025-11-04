import { describe, it, expect, beforeEach, vi } from "vitest"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { invoke, vscode } from "../../../utils/vscode"
import LocalSupervisorSettings from "../LocalSupervisor"
import type { SupervisorConfig } from "../../../state/supervisorSlice"

// Mock the vscode module
vi.mock("../../../utils/vscode", () => ({
	vscode: {
		postMessage: vi.fn(),
		getState: vi.fn(),
		setState: vi.fn(),
	},
	invoke: vi.fn(),
}))

// Default supervisor config for testing
const defaultConfig: SupervisorConfig = {
	version: 1,
	enabled: false,
	autoLaunch: false,
	bind: "127.0.0.1",
	port: 9611,
	provider: "ollama",
	endpoint: "http://127.0.0.1:11434",
	model: "llama3.1:8b-instruct-q4",
	max_tokens: 768,
	temperature: 0.2,
	redactLog: true,
	allowLAN: false,
	allowedLANs: ["10.0.4.0/24"],
}

describe("LocalSupervisorSettings", () => {
	const mockInvoke = vi.mocked(invoke)
	const mockPostMessage = vi.mocked(vscode.postMessage)

	beforeEach(() => {
		vi.clearAllMocks()
		// Default mock implementation for successful operations
		mockInvoke.mockResolvedValue(defaultConfig)
		mockPostMessage.mockImplementation(() => {})
	})

	it("renders the Local Supervisor settings form", async () => {
		render(<LocalSupervisorSettings />)

		await waitFor(() => {
			expect(screen.getByText("Local Supervisor")).toBeInTheDocument()
			expect(screen.getByLabelText("Enable")).toBeInTheDocument()
			expect(screen.getByLabelText("Auto-launch at app start")).toBeInTheDocument()
			// Allow LAN checkbox has a more complex label with a span inside
			expect(screen.getByText(/Allow LAN/)).toBeInTheDocument()
			expect(screen.getByDisplayValue("9611")).toBeInTheDocument()
			expect(screen.getByDisplayValue("http://127.0.0.1:11434")).toBeInTheDocument()
			expect(screen.getByDisplayValue("llama3.1:8b-instruct-q4")).toBeInTheDocument()
			expect(screen.getByDisplayValue("768")).toBeInTheDocument()
			expect(screen.getByDisplayValue("0.2")).toBeInTheDocument()
		})
	})

	it("saves configuration when Save button is clicked", async () => {
		const user = userEvent.setup()

		render(<LocalSupervisorSettings />)

		await waitFor(() => {
			expect(screen.getByText("Save")).toBeInTheDocument()
		})

		// Toggle the enable checkbox
		const enableCheckbox = screen.getByLabelText("Enable")
		await user.click(enableCheckbox)

		// Click save button
		const saveButton = screen.getByText("Save")
		await user.click(saveButton)

		// Check that supervisor:set was called with enabled: true
		await waitFor(() => {
			expect(mockInvoke).toHaveBeenCalledWith(
				"supervisor:set",
				expect.objectContaining({
					enabled: true,
				}),
			)
		})
	})

	it("validates that port is within range 9600-9699", async () => {
		const user = userEvent.setup()

		render(<LocalSupervisorSettings />)

		await waitFor(() => {
			expect(screen.getByDisplayValue("9611")).toBeInTheDocument()
		})

		// Mock invoke to reject for invalid port
		mockInvoke.mockImplementation((command) => {
			if (command === "supervisor:get") {
				return Promise.resolve(defaultConfig)
			}
			if (command === "supervisor:set") {
				return Promise.reject(new Error("The port should be between 9600 and 9699"))
			}
			return Promise.resolve({})
		})

		// Change port to invalid value by clicking and typing directly
		const portInput = screen.getByDisplayValue("9611")
		await user.click(portInput)
		await user.keyboard("{Control>}a{/Control}") // Select all
		await user.keyboard("9500")

		// Try to save
		const saveButton = screen.getByText("Save")
		await user.click(saveButton)

		// Should show error message
		await waitFor(
			() => {
				expect(screen.getByText(/The port should be between 9600 and 9699/)).toBeInTheDocument()
			},
			{ timeout: 3000 },
		)
	})

	it("displays error message when save fails", async () => {
		const user = userEvent.setup()
		const errorMessage = "Save failed"

		// Mock the invoke function to reject for supervisor:set
		mockInvoke.mockImplementation((command) => {
			if (command === "supervisor:get") {
				return Promise.resolve(defaultConfig)
			}
			if (command === "supervisor:set") {
				return Promise.reject(new Error(errorMessage))
			}
			return Promise.resolve({})
		})

		render(<LocalSupervisorSettings />)

		await waitFor(
			() => {
				expect(screen.getByText("Save")).toBeInTheDocument()
			},
			{ timeout: 10000 },
		)

		// Try to save
		const saveButton = screen.getByText("Save")
		await user.click(saveButton)

		// Should show error message
		await waitFor(
			() => {
				expect(screen.getByText(errorMessage)).toBeInTheDocument()
			},
			{ timeout: 10000 },
		)
	})

	it("resets form when Reset button is clicked", async () => {
		const user = userEvent.setup()

		render(<LocalSupervisorSettings />)

		await waitFor(() => {
			expect(screen.getByText("Reset")).toBeInTheDocument()
		})

		// Change some values
		const enableCheckbox = screen.getByLabelText("Enable")
		await user.click(enableCheckbox)

		const portInput = screen.getByDisplayValue("9611")
		await user.click(portInput)
		await user.keyboard("{Control>}a{/Control}")
		await user.type(portInput, "9650")

		// Click reset button
		const resetButton = screen.getByText("Reset")
		await user.click(resetButton)

		// Values should be reset to defaults
		await waitFor(() => {
			expect(screen.getByDisplayValue("9611")).toBeInTheDocument()
			expect(enableCheckbox).not.toBeChecked()
		})
	})
})

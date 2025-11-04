import React from "react"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { vi } from "vitest"
import ToolbarSupervisorToggle from "../ToolbarSupervisorToggle"
import { SupervisorProvider } from "../../../state/supervisorSlice"

// Mock the vscode utility
vi.mock("../../../utils/vscode", () => ({
	invoke: vi.fn(),
}))

describe("ToolbarSupervisorToggle", () => {
	const renderWithProvider = (component: React.ReactElement) => {
		return render(<SupervisorProvider>{component}</SupervisorProvider>)
	}

	it("renders the toggle button with SV OFF state initially", () => {
		renderWithProvider(<ToolbarSupervisorToggle />)

		const button = screen.getByTestId("toolbar-supervisor-toggle")
		expect(button).toBeInTheDocument()
		expect(button).toHaveTextContent("SV OFF")
		expect(button).toHaveAttribute("aria-pressed", "false")
		expect(button).toHaveAttribute("title", "Supervisor: OFF (Ctrl+Alt+L)")
	})

	it("toggles state when clicked", async () => {
		const user = userEvent.setup()
		renderWithProvider(<ToolbarSupervisorToggle />)

		const button = screen.getByTestId("toolbar-supervisor-toggle")

		// Initial state should be OFF
		expect(button).toHaveTextContent("SV OFF")
		expect(button).toHaveAttribute("aria-pressed", "false")

		// Click to toggle ON
		await user.click(button)

		// State should now be ON
		expect(button).toHaveTextContent("SV ON")
		expect(button).toHaveAttribute("aria-pressed", "true")
		expect(button).toHaveAttribute("title", "Supervisor: ON (Ctrl+Alt+L)")

		// Click to toggle OFF again
		await user.click(button)

		// State should be OFF again
		expect(button).toHaveTextContent("SV OFF")
		expect(button).toHaveAttribute("aria-pressed", "false")
		expect(button).toHaveAttribute("title", "Supervisor: OFF (Ctrl+Alt+L)")
	})

	it("has correct CSS classes based on state", async () => {
		const user = userEvent.setup()
		renderWithProvider(<ToolbarSupervisorToggle />)

		const button = screen.getByTestId("toolbar-supervisor-toggle")

		// Initial state (OFF) should have neutral background
		expect(button).toHaveClass("bg-neutral-700", "text-white")
		expect(button).not.toHaveClass("bg-green-600")

		// Toggle to ON
		await user.click(button)

		// ON state should have green background
		expect(button).toHaveClass("bg-green-600", "text-white")
		expect(button).not.toHaveClass("bg-neutral-700")
	})

	it("has correct accessibility attributes", () => {
		renderWithProvider(<ToolbarSupervisorToggle />)

		const button = screen.getByTestId("toolbar-supervisor-toggle")

		// Check for aria-pressed attribute
		expect(button).toHaveAttribute("aria-pressed")

		// Check for title attribute which includes keyboard shortcut
		expect(button).toHaveAttribute("title")
		expect(button.getAttribute("title")).toContain("Ctrl+Alt+L")
	})

	it("has data-testid for testing", () => {
		renderWithProvider(<ToolbarSupervisorToggle />)

		const button = screen.getByTestId("toolbar-supervisor-toggle")
		expect(button).toBeInTheDocument()
	})
})

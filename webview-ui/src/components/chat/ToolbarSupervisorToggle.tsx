import React from "react"
import { Zap } from "lucide-react"
import { useSupervisor } from "../../state/supervisorSlice"

export default function ToolbarSupervisorToggle() {
	const { enabled, setEnabled } = useSupervisor()
	return (
		<button
			title={enabled ? "Supervisor: ON (Ctrl+Alt+L)" : "Supervisor: OFF (Ctrl+Alt+L)"}
			onClick={() => setEnabled(!enabled)}
			className={
				"px-2 py-1 rounded text-sm flex items-center gap-1 " +
				(enabled ? "bg-green-600 text-white" : "bg-neutral-700 text-white")
			}
			aria-pressed={enabled}
			data-testid="toolbar-supervisor-toggle">
			<Zap className="w-3 h-3" />
			{enabled ? "SV ON" : "SV OFF"}
		</button>
	)
}

import React, { useState, useEffect } from "react"
import { usePatcherChat, PatcherEvent } from "../../state/patcherSlice"
import { VSCodeButton } from "@vscode/webview-ui-toolkit/react"

/**
 * Interface for SmartPatchMessage component props
 */
interface SmartPatchMessageProps {
	/** ID of message that triggered patcher event */
	messageId: string
}

/**
 * Interface for funny messages data structure
 */
interface FunnyMessages {
	version: number
	maxPerClass: number
	messages: Record<string, string[]>
}

/**
 * SmartPatchMessage component displays patcher event information in a card format
 *
 * This component follows existing message card patterns with:
 * - Expandable/collapsible details section with chevron
 * - CPU icon with funny message in header
 * - Detailed information when expanded
 * - Action buttons for patcher operations
 *
 * @param props - Component props
 * @param props.messageId - ID of message that triggered patcher event
 *
 * @example
 * ```tsx
 * <SmartPatchMessage messageId="msg-123" />
 * ```
 */
export const SmartPatchMessage: React.FC<SmartPatchMessageProps> = ({ messageId }) => {
	const { getEvent } = usePatcherChat()
	const [isExpanded, setIsExpanded] = useState(false)
	const [funnyMessage, setFunnyMessage] = useState<string>("")
	const [event, setEvent] = useState<PatcherEvent | undefined>(undefined)

	// Get patcher event for this message
	useEffect(() => {
		const patcherEvent = getEvent(messageId)
		setEvent(patcherEvent)

		if (patcherEvent) {
			// Load and select a funny message
			loadFunnyMessage(patcherEvent.classification)
		}
	}, [messageId, getEvent])

	/**
	 * Load funny messages from JSON file and randomly select one
	 * for given classification
	 *
	 * @param classification - The patcher event classification
	 */
	const loadFunnyMessage = async (classification: string) => {
		try {
			// Import funny messages JSON
			const response = await fetch("/.kilocode/patch-plans/funny-messages.json")
			if (!response.ok) {
				throw new Error(`Failed to load funny messages: ${response.statusText}`)
			}

			const data: FunnyMessages = await response.json()

			// Get messages for classification, fallback to "unknown"
			const messages = data.messages[classification] || data.messages.unknown || []

			if (messages.length > 0) {
				// Select a random message
				const randomIndex = Math.floor(Math.random() * messages.length)
				setFunnyMessage(messages[randomIndex])
			} else {
				setFunnyMessage("Smart patcher reporting. 👋")
			}
		} catch (error) {
			console.error("Error loading funny messages:", error)
			setFunnyMessage("Smart patcher reporting. 👋")
		}
	}

	/**
	 * Toggle expanded state of details section
	 */
	const handleToggleExpand = () => {
		setIsExpanded(!isExpanded)
	}

	/**
	 * Send a message to run patcher in dry-run mode
	 */
	const handleDryRun = () => {
		window.postMessage({ type: "patcher:run", mode: "dry" })
	}

	/**
	 * Send a message to open the patcher plan
	 */
	const handleOpenPlan = () => {
		window.postMessage({ type: "patcher:openPlan" })
	}

	// Don't render if no event is found
	if (!event) {
		return null
	}

	return (
		<div className="mt-2">
			{/* Header with CPU icon and funny message */}
			<div
				className="flex items-center justify-between cursor-pointer select-none p-2 bg-vscode-badge-background border border-vscode-editorGroup-border rounded-xs"
				onClick={handleToggleExpand}>
				<div className="flex items-center gap-2">
					<span className="codicon codicon-server-environment text-vscode-badge-foreground" />
					<span className="font-medium text-vscode-badge-foreground">{funnyMessage}</span>
				</div>
				<span
					className={`codicon codicon-chevron-${isExpanded ? "up" : "down"} text-vscode-badge-foreground`}
				/>
			</div>

			{/* Expanded details section */}
			{isExpanded && (
				<div className="mt-1 p-3 bg-vscode-editor-background border-l border-r border-b border-vscode-editorGroup-border rounded-b-xs">
					<div className="flex flex-col gap-2">
						{/* Classification */}
						<div className="flex items-center gap-2">
							<span className="font-semibold text-vscode-foreground">Classification:</span>
							<span className="text-vscode-descriptionForeground">{event.classification}</span>
						</div>

						{/* File path */}
						{event.file && (
							<div className="flex items-center gap-2">
								<span className="font-semibold text-vscode-foreground">File:</span>
								<span className="text-vscode-descriptionForeground">{event.file}</span>
							</div>
						)}

						{/* Error message */}
						{event.error && (
							<div className="flex flex-col gap-1">
								<span className="font-semibold text-vscode-foreground">Error:</span>
								<span className="text-vscode-descriptionForeground">{event.error}</span>
							</div>
						)}

						{/* Suggested plan */}
						{event.suggestedPlan && (
							<div className="flex flex-col gap-1">
								<span className="font-semibold text-vscode-foreground">Suggested Plan:</span>
								<div className="text-vscode-descriptionForeground">
									{event.suggestedPlan.anchor?.after && (
										<div>Anchor after: {event.suggestedPlan.anchor.after}</div>
									)}
									{event.suggestedPlan.anchor?.before && (
										<div>Anchor before: {event.suggestedPlan.anchor.before}</div>
									)}
									{event.suggestedPlan.anchor?.insert && (
										<div>Anchor insert: {event.suggestedPlan.anchor.insert}</div>
									)}
								</div>
							</div>
						)}

						{/* Action buttons */}
						<div className="flex gap-2 mt-2">
							<VSCodeButton appearance="secondary" onClick={handleDryRun}>
								Dry-run
							</VSCodeButton>
							<VSCodeButton appearance="primary" onClick={handleOpenPlan}>
								Open plan
							</VSCodeButton>
						</div>
					</div>
				</div>
			)}
		</div>
	)
}

export default SmartPatchMessage

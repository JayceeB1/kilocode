import React, { createContext, useContext, useEffect, useState } from "react"

/**
 * Patcher event classification types
 */
export type PatcherClassification = "applied" | "anchor_mismatch" | "lint_error" | "type_error" | "noop" | "unknown"

/**
 * Interface for a patcher event
 */
export interface PatcherEvent {
	/** ID of the message that triggered the patcher event */
	messageId: string
	/** Classification of the patcher result */
	classification: PatcherClassification
	/** Optional file path where the patcher was applied */
	file?: string
	/** Optional error description if the patcher failed */
	error?: string
	/** Optional suggested plan for remediation */
	suggestedPlan?: any
	/** Timestamp when the event was received */
	ts: number
}

/**
 * Interface for the patcher events state
 */
export interface PatcherState {
	/** Map of patcher events indexed by messageId */
	events: Record<string, PatcherEvent>
}

/**
 * Context type for the patcher chat provider
 */
type PatcherContextType = {
	/** Current patcher state */
	state: PatcherState
	/** Function to add or update a patcher event */
	addOrUpdateEvent: (event: PatcherEvent) => void
	/** Function to clear all patcher events */
	clearEvents: () => void
	/** Function to get a specific patcher event by messageId */
	getEvent: (messageId: string) => PatcherEvent | undefined
}

/**
 * Default context value
 */
const PatcherContext = createContext<PatcherContextType>({
	state: { events: {} },
	addOrUpdateEvent: () => {},
	clearEvents: () => {},
	getEvent: () => undefined,
})

/**
 * Provider component for patcher event state management
 *
 * This component listens for "supervisor:patcherEvent" messages from the window
 * and maintains an in-memory map of events by messageId.
 *
 * @param children - React children components
 *
 * @example
 * ```tsx
 * <PatcherChatProvider>
 *   <App />
 * </PatcherChatProvider>
 * ```
 */
export const PatcherChatProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
	const [state, setState] = useState<PatcherState>({ events: {} })

	/**
	 * Add or update a patcher event in the state
	 *
	 * @param event - The patcher event to add or update
	 */
	const addOrUpdateEvent = (event: PatcherEvent) => {
		setState((prevState) => ({
			events: {
				...prevState.events,
				[event.messageId]: event,
			},
		}))
	}

	/**
	 * Clear all patcher events from the state
	 */
	const clearEvents = () => {
		setState({ events: {} })
	}

	/**
	 * Get a specific patcher event by messageId
	 *
	 * @param messageId - The message ID to look up
	 * @returns The patcher event if found, undefined otherwise
	 */
	const getEvent = (messageId: string): PatcherEvent | undefined => {
		return state.events[messageId]
	}

	/**
	 * Effect to listen for supervisor:patcherEvent messages
	 */
	useEffect(() => {
		const handleMessage = (event: MessageEvent) => {
			const message = event.data

			// Check if this is a supervisor:patcherEvent message
			if (message?.type === "supervisor:patcherEvent") {
				try {
					// Validate required fields
					if (!message.messageId || !message.classification) {
						throw new Error("Missing required fields: messageId and classification")
					}

					const patcherEvent: PatcherEvent = {
						messageId: message.messageId,
						classification: message.classification,
						file: message.file,
						error: message.error,
						suggestedPlan: message.suggestedPlan,
						ts: Date.now(),
					}

					addOrUpdateEvent(patcherEvent)
				} catch (error) {
					console.error("Failed to process supervisor:patcherEvent message:", error)
				}
			}
		}

		// Add event listener for window messages
		window.addEventListener("message", handleMessage)

		// Clean up event listener on unmount
		return () => {
			window.removeEventListener("message", handleMessage)
		}
	}, [])

	const contextValue: PatcherContextType = {
		state,
		addOrUpdateEvent,
		clearEvents,
		getEvent,
	}

	return React.createElement(PatcherContext.Provider, { value: contextValue }, children)
}

/**
 * Hook to access patcher chat state and functions
 *
 * This hook provides access to the patcher events map and utility functions
 * for managing patcher events. It follows the existing hook patterns in the codebase.
 *
 * @returns The patcher context containing state and utility functions
 *
 * @example
 * ```tsx
 * const { state, getEvent, clearEvents } = usePatcherChat();
 *
 * // Access all events
 * const allEvents = state.events;
 *
 * // Get a specific event
 * const event = getEvent('message-123');
 *
 * // Clear all events
 * clearEvents();
 * ```
 */
export const usePatcherChat = (): PatcherContextType => {
	return useContext(PatcherContext)
}

/**
 * Utility function to create a patcher event object
 *
 * @param messageId - ID of the message that triggered the patcher event
 * @param classification - Classification of the patcher result
 * @param file - Optional file path where the patcher was applied
 * @param error - Optional error description if the patcher failed
 * @param suggestedPlan - Optional suggested plan for remediation
 * @returns A properly formatted patcher event object
 *
 * @example
 * ```tsx
 * const event = createPatcherEvent(
 *   'msg-123',
 *   'applied',
 *   '/path/to/file.ts',
 *   undefined,
 *   { action: 'retry' }
 * );
 * ```
 */
export const createPatcherEvent = (
	messageId: string,
	classification: PatcherClassification,
	file?: string,
	error?: string,
	suggestedPlan?: any,
): PatcherEvent => ({
	messageId,
	classification,
	file,
	error,
	suggestedPlan,
	ts: Date.now(),
})

/**
 * Utility function to check if a patcher event represents a successful operation
 *
 * @param event - The patcher event to check
 * @returns True if the event represents a successful operation, false otherwise
 *
 * @example
 * ```tsx
 * const event = getEvent('msg-123');
 * if (isSuccessfulEvent(event)) {
 *   console.log('Patch was applied successfully');
 * }
 * ```
 */
export const isSuccessfulEvent = (event: PatcherEvent): boolean => {
	return event.classification === "applied"
}

/**
 * Utility function to check if a patcher event represents an error condition
 *
 * @param event - The patcher event to check
 * @returns True if the event represents an error condition, false otherwise
 *
 * @example
 * ```tsx
 * const event = getEvent('msg-123');
 * if (isErrorEvent(event)) {
 *   console.error('Patch failed:', event.error);
 * }
 * ```
 */
export const isErrorEvent = (event: PatcherEvent): boolean => {
	return (
		event.classification === "anchor_mismatch" ||
		event.classification === "lint_error" ||
		event.classification === "type_error" ||
		!!event.error
	)
}

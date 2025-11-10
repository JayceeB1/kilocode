/**
 * Chat message interface for LLM providers
 */
export interface ChatMessage {
	role: "system" | "user" | "assistant"
	content: string
}

/**
 * Input interface for chat completion
 */
export interface ChatInput {
	messages: ChatMessage[]
	model?: string
	temperature?: number
	max_tokens?: number
	stream?: boolean
}

/**
 * Output interface for chat completion
 */
export interface ChatOutput {
	text: string
	usage?: {
		prompt_tokens?: number
		completion_tokens?: number
		total_tokens?: number
	}
}

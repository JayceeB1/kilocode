/**
 * LLM facade module for code analysis
 * Provides a unified interface for different LLM providers
 */

export { analyzeWithOllama, chatWithOllama, type LlmAnalysis } from "./ollamaClient.js"
export { chatWithLlamaCpp, analyzeWithLlamaCpp } from "./llamacppClient.js"
export type { ChatInput, ChatOutput, ChatMessage } from "./types.js"

import { getConfig } from "../config.js"
import { analyzeWithOllama, chatWithOllama, type LlmAnalysis } from "./ollamaClient.js"
import { chatWithLlamaCpp, analyzeWithLlamaCpp } from "./llamacppClient.js"
import type { ChatInput, ChatOutput } from "./types.js"
import { redact } from "../utils/redact.js"

/**
 * Analyzes code using the configured LLM provider
 * @param code - The code to analyze
 * @param language - Optional programming language hint
 * @param filePath - Optional file path for context
 * @param context - Optional additional context
 * @returns Promise resolving to LLM analysis
 */
export async function analyzeWithLLM(
	code: string,
	language?: string,
	filePath?: string,
	context?: string,
): Promise<LlmAnalysis> {
	const config = getConfig()

	switch (config.provider) {
		case "ollama":
			return analyzeWithOllama(code, language, filePath, context)
		case "llama.cpp":
			return analyzeWithLlamaCpp(code, language, filePath, context)
		default:
			throw new Error(`Unsupported LLM provider: ${config.provider}`)
	}
}

/**
 * Chat with the configured LLM provider
 * @param input - Chat input with messages and parameters
 * @returns Promise resolving to chat output
 */
export async function chat(input: ChatInput): Promise<ChatOutput> {
	const cfg = getConfig()
	const provider = cfg.provider || "ollama"
	try {
		if (provider === "llama.cpp") {
			return await chatWithLlamaCpp(input)
		}
		return await chatWithOllama(input)
	} catch (e: any) {
		// Log without secrets
		console.error(`[llm] ${provider} error:`, redact(e?.message || String(e)))
		throw e
	}
}

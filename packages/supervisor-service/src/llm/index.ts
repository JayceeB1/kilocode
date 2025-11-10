/**
 * LLM facade module for code analysis
 * Provides a unified interface for different LLM providers
 */

export { analyzeWithOllama, type LlmAnalysis } from "./ollamaClient.js"

import { getConfig } from "../config.js"
import { analyzeWithOllama, type LlmAnalysis } from "./ollamaClient.js"

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
			console.warn("llama.cpp provider not yet implemented, falling back to Ollama")
			return analyzeWithOllama(code, language, filePath, context)
		default:
			throw new Error(`Unsupported LLM provider: ${config.provider}`)
	}
}

import { getConfig } from "../config.js"
import type { AnalyzeResponse } from "../analyze.js"
import type { ChatInput, ChatOutput } from "./types.js"
import { redact } from "../utils/redact.js"

/**
 * LLM analysis interface
 */
export interface LlmAnalysis {
	issues: Array<{
		type: string
		severity: "error" | "warning" | "info"
		message: string
		line?: number
		column?: number
		suggestion?: string
		confidence?: number
	}>
	suggestions: string[]
	fixedCode?: string
}

/**
 * Chat with Ollama using HTTP API
 * @param input - Chat input with messages and parameters
 * @returns Promise resolving to chat output
 */
export async function chatWithOllama(input: ChatInput): Promise<ChatOutput> {
	const cfg = getConfig()
	const endpoint = (cfg.endpoint || "http://127.0.0.1:11434").replace(/\/+$/, "")
	const url = `${endpoint}/api/chat`

	const body = {
		model: input.model || "qwen2.5-coder:latest",
		messages: input.messages, // [{role, content}]
		stream: false,
		options: {
			temperature: input.temperature ?? 0.2,
			num_predict: input.max_tokens ?? 768,
		},
	}

	const resp = await fetch(url, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify(body),
	})
	if (!resp.ok) {
		const text = await resp.text().catch(() => "")
		throw new Error(`Ollama HTTP ${resp.status} – ${redact(text)}`)
	}
	const json = (await resp.json()) as any
	// Ollama /api/chat → { message: { content: string } }
	const text = json?.message?.content ?? ""
	return { text }
}

/**
 * Analyzes code using Ollama locally via HTTP API
 * @param code - The code to analyze
 * @param language - Optional programming language hint
 * @param filePath - Optional file path for context
 * @param context - Optional additional context
 * @returns Promise resolving to LLM analysis
 */
export async function analyzeWithOllama(
	code: string,
	language?: string,
	filePath?: string,
	context?: string,
): Promise<LlmAnalysis> {
	const config = getConfig()

	try {
		// Construct the prompt
		const prompt = buildAnalysisPrompt(code, language, filePath, context)

		// Prepare messages for chat API
		const messages: ChatInput["messages"] = [
			{
				role: "system",
				content: "You are a code analysis expert. Analyze code and provide structured JSON responses.",
			},
			{ role: "user", content: prompt },
		]

		// Call Ollama HTTP API
		const response = await chatWithOllama({
			messages,
			model: config.model,
			temperature: config.temperature,
			max_tokens: config.max_tokens,
		})

		// Extract JSON from the response
		const analysis = extractJsonFromResponse(response.text)

		// Validate and return the analysis
		return validateAnalysis(analysis)
	} catch (error) {
		console.warn("Ollama analysis failed, using fallback:", error)
		return getFallbackAnalysis(code)
	}
}

/**
 * Builds a comprehensive analysis prompt for the LLM
 */
function buildAnalysisPrompt(code: string, language?: string, filePath?: string, context?: string): string {
	const languageHint = language ? `The code is written in ${language}.` : ""
	const filePathHint = filePath ? `File path: ${filePath}.` : ""
	const contextHint = context ? `Additional context: ${context}.` : ""

	return `You are a code analysis expert. Analyze the following code and provide a structured JSON response.

${languageHint}
${filePathHint}
${contextHint}

Code to analyze:
\`\`\`
${code}
\`\`\`

Please analyze the code and return a JSON object with the following structure:
{
  "issues": [
    {
      "type": "string",
      "severity": "error" | "warning" | "info",
      "message": "string",
      "line": number,
      "column": number,
      "suggestion": "string",
      "confidence": number (0-1)
    }
  ],
  "suggestions": ["string"],
  "fixedCode": "string (optional, only if you can provide a clear fix)"
}

Focus on:
1. Syntax errors and potential bugs
2. Code quality issues
3. Security vulnerabilities
4. Performance concerns
5. Best practices violations

Return only the JSON object, no additional text.`
}

/**
 * Extracts JSON from LLM response with fallback parsing
 */
function extractJsonFromResponse(response: string): any {
	try {
		// Try to parse the entire response as JSON
		return JSON.parse(response)
	} catch {
		try {
			// Try to extract JSON from markdown code blocks
			const jsonMatch = response.match(/```(?:json)?\s*([\s\S]*?)\s*```/)
			if (jsonMatch && typeof jsonMatch[1] === "string") {
				return JSON.parse(jsonMatch[1])
			}

			// Try to find JSON object in the response
			const objectMatch = response.match(/\{[\s\S]*\}/)
			if (objectMatch) {
				return JSON.parse(objectMatch[0])
			}
		} catch (error) {
			console.warn("Failed to extract JSON from response:", error)
		}

		// If all parsing attempts fail, return null
		return null
	}
}

/**
 * Validates and normalizes the analysis object
 */
function validateAnalysis(analysis: any): LlmAnalysis {
	if (!analysis || typeof analysis !== "object") {
		return getFallbackAnalysis("")
	}

	// Ensure issues is an array
	const issues = Array.isArray(analysis.issues) ? analysis.issues : []

	// Normalize issues
	const normalizedIssues = issues.map((issue: any) => ({
		type: typeof issue.type === "string" ? issue.type : "unknown",
		severity: ["error", "warning", "info"].includes(issue.severity) ? issue.severity : "info",
		message: typeof issue.message === "string" ? issue.message : "No message provided",
		line: typeof issue.line === "number" ? issue.line : undefined,
		column: typeof issue.column === "number" ? issue.column : undefined,
		suggestion: typeof issue.suggestion === "string" ? issue.suggestion : undefined,
		confidence:
			typeof issue.confidence === "number" && issue.confidence >= 0 && issue.confidence <= 1
				? issue.confidence
				: 0.5,
	}))

	// Ensure suggestions is an array
	const suggestions = Array.isArray(analysis.suggestions) ? analysis.suggestions : []

	// Normalize suggestions
	const normalizedSuggestions = suggestions.filter((s: any) => typeof s === "string").slice(0, 10) // Limit to 10 suggestions

	return {
		issues: normalizedIssues,
		suggestions: normalizedSuggestions,
		fixedCode: typeof analysis.fixedCode === "string" ? analysis.fixedCode : undefined,
	}
}

/**
 * Provides a fallback analysis when Ollama is unavailable
 */
function getFallbackAnalysis(code: string): LlmAnalysis {
	const issues = []

	// Basic syntax checks
	if (code.includes("TODO") || code.includes("FIXME")) {
		issues.push({
			type: "maintenance",
			severity: "info" as const,
			message: "Code contains TODO or FIXME comments",
			suggestion: "Consider addressing the noted items",
			confidence: 0.9,
		})
	}

	// Check for common issues
	if (code.includes("console.log") && !code.includes("test")) {
		issues.push({
			type: "debugging",
			severity: "warning" as const,
			message: "Console.log statement detected",
			suggestion: "Remove or replace with proper logging",
			confidence: 0.8,
		})
	}

	return {
		issues,
		suggestions: [
			"Consider adding type annotations",
			"Review error handling patterns",
			"Add unit tests for critical functionality",
		],
		fixedCode: undefined,
	}
}

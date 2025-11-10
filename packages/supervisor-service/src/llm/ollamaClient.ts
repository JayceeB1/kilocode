import { getConfig } from "../config.js"
import type { AnalyzeResponse } from "../analyze.js"

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
 * Analyzes code using Ollama locally
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
	context?: string
): Promise<LlmAnalysis> {
	const config = getConfig()
	
	try {
		// Import ollama dynamically to avoid issues when package is not available
		const { default: ollama } = await import("ollama")
		
		// Construct the prompt
		const prompt = buildAnalysisPrompt(code, language, filePath, context)
		
		// Call Ollama API
		const response = await ollama.generate({
			model: config.model,
			prompt,
			options: {
				temperature: config.temperature,
				num_predict: config.max_tokens,
			},
		})
		
		// Extract JSON from the response
		const analysis = extractJsonFromResponse(response.response)
		
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
function buildAnalysisPrompt(
	code: string,
	language?: string,
	filePath?: string,
	context?: string
): string {
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
			if (jsonMatch) {
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
		confidence: typeof issue.confidence === "number" && issue.confidence >= 0 && issue.confidence <= 1 
			? issue.confidence 
			: 0.5,
	}))
	
	// Ensure suggestions is an array
	const suggestions = Array.isArray(analysis.suggestions) ? analysis.suggestions : []
	
	// Normalize suggestions
	const normalizedSuggestions = suggestions
		.filter((s: any) => typeof s === "string")
		.slice(0, 10) // Limit to 10 suggestions
	
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
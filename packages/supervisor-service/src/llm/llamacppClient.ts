import type { ChatInput, ChatOutput } from "./types.js"
import { getConfig } from "../config.js"
import { redact } from "../utils/redact.js"
import type { LlmAnalysis } from "./ollamaClient.js"

/**
 * Chat with llama.cpp using OpenAI-compatible API
 * @param input - Chat input with messages and parameters
 * @returns Promise resolving to chat output
 */
export async function chatWithLlamaCpp(input: ChatInput): Promise<ChatOutput> {
	const cfg = getConfig()
	// ex: http://127.0.0.1:8080  (with /v1 in suffix optional)
	const base = (cfg.endpoint || "http://127.0.0.1:8080").replace(/\/+$/, "")
	const url = `${base}/v1/chat/completions`

	const body = {
		model: input.model || "llama",
		messages: input.messages, // [{role, content}]
		temperature: input.temperature ?? 0.2,
		max_tokens: input.max_tokens ?? 768,
		stream: false,
	}

	const resp = await fetch(url, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify(body),
	})
	if (!resp.ok) {
		const text = await resp.text().catch(() => "")
		throw new Error(`llama.cpp HTTP ${resp.status} – ${redact(text)}`)
	}
	const json = (await resp.json()) as any
	// OpenAI compat → { choices: [{ message: { content } }] }
	const text = json?.choices?.[0]?.message?.content ?? ""
	return { text }
}

// Builds the analysis prompt (parity with Ollama)
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
	     "confidence": number
	   }
	 ],
	 "suggestions": ["string"],
	 "fixedCode": "string"
}
Return only the JSON object, no additional text.`
}

function extractJsonFromResponse(text: string): any {
	try {
		return JSON.parse(text)
	} catch {}
	try {
		const md = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/)
		if (md && typeof md[1] === "string") return JSON.parse(md[1])
		const obj = text.match(/\{[\s\S]*\}/)
		if (obj) return JSON.parse(obj[0]!)
	} catch {}
	return null
}

function getFallbackAnalysis(code: string): LlmAnalysis {
	return {
		issues: [{ type: "unknown", severity: "info", message: "Fallback analysis (llama.cpp)", confidence: 0.1 }],
		suggestions: ["Review code manually."],
		fixedCode: code,
	}
}

function validateAnalysis(analysis: any): LlmAnalysis {
	if (!analysis || typeof analysis !== "object") return getFallbackAnalysis("")
	const issues = Array.isArray(analysis.issues) ? analysis.issues : []
	const normIssues = issues.map((i: any) => ({
		type: typeof i?.type === "string" ? i.type : "unknown",
		severity: (["error", "warning", "info"] as const).includes(i?.severity) ? i.severity : "info",
		message: typeof i?.message === "string" ? i.message : "Unspecified",
		line: typeof i?.line === "number" ? i.line : undefined,
		column: typeof i?.column === "number" ? i.column : undefined,
		suggestion: typeof i?.suggestion === "string" ? i.suggestion : undefined,
		confidence: typeof i?.confidence === "number" ? i.confidence : undefined,
	}))
	const suggestions = Array.isArray(analysis.suggestions)
		? analysis.suggestions.filter((s: any) => typeof s === "string")
		: []
	const fixedCode = typeof analysis.fixedCode === "string" ? analysis.fixedCode : undefined
	return { issues: normIssues, suggestions, fixedCode }
}

/**
 * Analyze via llama.cpp (OpenAI-compat /v1/chat/completions)
 */
export async function analyzeWithLlamaCpp(
	code: string,
	language?: string,
	filePath?: string,
	context?: string,
): Promise<LlmAnalysis> {
	const cfg = getConfig()
	const base = cfg.endpoint?.replace(/\/$/, "") || "http://127.0.0.1:8080"
	const url = `${base}/v1/chat/completions`
	const sys = "You are a senior code reviewer. Respond with JSON only."
	const user = buildAnalysisPrompt(code, language, filePath, context)

	try {
		const resp = await fetch(url, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				model: cfg.model,
				messages: [
					{ role: "system", content: sys },
					{ role: "user", content: user },
				],
				temperature: cfg.temperature,
				max_tokens: cfg.max_tokens,
				stream: false,
			}),
		})
		if (!resp.ok) throw new Error(`llama.cpp HTTP ${resp.status}`)
		const data = (await resp.json()) as any
		const text = data?.choices?.[0]?.message?.content ?? ""
		const parsed = extractJsonFromResponse(String(text || ""))
		return validateAnalysis(parsed)
	} catch (e) {
		console.warn("llama.cpp analysis failed, fallback:", e)
		return getFallbackAnalysis(code)
	}
}

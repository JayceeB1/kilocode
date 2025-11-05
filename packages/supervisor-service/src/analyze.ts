import { Request, Response } from "express"
import { getConfig } from "./config.js"

export interface AnalyzeRequest {
	code: string
	language?: string
	filePath?: string
	context?: string
}

export interface AnalyzeResponse {
	analysis: {
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
	metadata: {
		model: string
		provider: string
		tokensUsed?: number
		processingTime: number
	}
}

export async function analyzeCode(req: Request, res: Response): Promise<void> {
	const startTime = Date.now()

	try {
		const rawBody = (req as any)?.body ?? {}
		const code = typeof rawBody.code === "string" ? rawBody.code : undefined

		if (!code) {
			res.status(400).json({
				error: "Invalid request: code is required and must be a string",
			})
			return
		}

		const config = getConfig()

		// For now, return a mock analysis
		// In a real implementation, this would call the LLM provider
		const mockAnalysis: AnalyzeResponse = {
			analysis: {
				issues: [
					{
						type: "syntax",
						severity: "warning",
						message: "Potential syntax issue detected",
						line: 1,
						suggestion: "Check for missing semicolons or brackets",
						confidence: 0.8,
					},
				],
				suggestions: ["Consider adding type annotations", "Review error handling patterns"],
				fixedCode: code, // Would contain actual fixes in real implementation
			},
			metadata: {
				model: config.model,
				provider: config.provider,
				tokensUsed: 150,
				processingTime: Date.now() - startTime,
			},
		}

		res.json(mockAnalysis)
	} catch (error) {
		console.error("Analysis error:", error)
		res.status(500).json({
			error: "Internal server error during analysis",
			details: error instanceof Error ? error.message : "Unknown error",
		})
	}
}

export async function healthCheck(req: Request, res: Response): Promise<void> {
	try {
		const config = getConfig()
		res.json({
			status: "healthy",
			service: "kilocode-supervisor-service",
			version: "0.0.0",
			config: {
				provider: config.provider,
				model: config.model,
				bind: config.bind,
				port: config.port,
			},
		})
	} catch (error) {
		res.status(500).json({
			status: "unhealthy",
			error: error instanceof Error ? error.message : "Unknown error",
		})
	}
}

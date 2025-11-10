import { getConfig } from "../config.js"

export interface SafeErrorDetails {
	message: string
	redacted: boolean
}

export function buildSafeErrorDetails(error: unknown): SafeErrorDetails {
	const fallback = error instanceof Error ? error.message : "Unknown error"

	try {
		const { redactLog } = getConfig()
		return {
			message: redactLog ? "redacted" : fallback,
			redacted: redactLog,
		}
	} catch {
		return {
			message: fallback,
			redacted: false,
		}
	}
}

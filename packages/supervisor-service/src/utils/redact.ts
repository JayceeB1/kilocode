import { getConfig } from "../config.js"

/**
 * Redacts sensitive information from text based on configuration
 * @param text - The text to redact
 * @returns Redacted text or original text if redaction is disabled
 */
export function redact(text: string): string {
	try {
		const { redactLog } = getConfig()
		if (!redactLog) {
			return text
		}

		// Redact common sensitive patterns
		return (
			text
				// API keys and tokens
				.replace(/([a-zA-Z0-9_-]{20,})/g, "[REDACTED]")
				// URLs with potential sensitive data
				.replace(/(https?:\/\/[^\s]+)/g, "[URL_REDACTED]")
				// Email addresses
				.replace(/([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/g, "[EMAIL_REDACTED]")
				// IP addresses
				.replace(/\b(?:[0-9]{1,3}\.){3}[0-9]{1,3}\b/g, "[IP_REDACTED]")
		)
	} catch {
		// If config is not available, return original text
		return text
	}
}

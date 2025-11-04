/**
 * Error classification and remediation system for the Smart Patcher
 */

import { PatchOp, PatchResult, PatchOutcome } from "./types.js"
import { ErrorClassification, ErrorSeverity, ErrorReport } from "../contracts/error-report.js"
import { RemediationPlan, SuggestedOp, RemediationStrategy } from "../contracts/remediation-plan.js"

/**
 * Classifies tool messages into error categories
 * @param msg - The error message to classify
 * @returns The appropriate ErrorClassification enum value
 */
export function classifyToolMessage(msg: string): ErrorClassification {
	const message = msg.toLowerCase().trim()

	// Check for already applied errors
	if (
		message.includes("search and replace content are identical") ||
		message.includes("content is the same") ||
		message.includes("no changes needed") ||
		message.includes("already applied")
	) {
		return ErrorClassification.ALREADY_APPLIED
	}

	// Check for anchor mismatch errors
	if (
		message.includes("no match for patch hunk") ||
		message.includes("anchor not found") ||
		message.includes("could not find anchor") ||
		message.includes("anchor mismatch")
	) {
		return ErrorClassification.ANCHOR_MISMATCH
	}

	// Check for ESLint errors
	if (
		message.includes("eslint error") ||
		message.includes("linting error") ||
		message.includes("lint error") ||
		message.includes("eslint:") ||
		(message.includes("warning") && /\d+:\d+/.test(message)) ||
		(message.includes("error") && /\d+:\d+/.test(message))
	) {
		return ErrorClassification.LINT_ERROR
	}

	// Check for TypeScript compile failures
	if (
		message.includes("typescript error") ||
		message.includes("compile error") ||
		message.includes("type error") ||
		message.includes("cannot find name") ||
		(message.includes("property") && message.includes("does not exist")) ||
		(message.includes("type") && message.includes("is not assignable"))
	) {
		return ErrorClassification.TYPE_ERROR
	}

	// Check for IPC timeouts
	if (
		message.includes("timeout") ||
		message.includes("timed out") ||
		message.includes("ipc timeout") ||
		message.includes("rpc timeout")
	) {
		return ErrorClassification.TIMEOUT
	}

	// Check for file not found errors
	if (
		message.includes("file not found") ||
		message.includes("no such file") ||
		message.includes("enoent") ||
		message.includes("cannot find file") ||
		message.includes("file does not exist")
	) {
		return ErrorClassification.FILE_NOT_FOUND
	}

	// Check for permission errors
	if (
		message.includes("permission denied") ||
		message.includes("access denied") ||
		message.includes("eacces") ||
		message.includes("eperm") ||
		message.includes("unauthorized")
	) {
		return ErrorClassification.PERMISSION_ERROR
	}

	// Check for security violations
	if (
		message.includes("security error") ||
		message.includes("security violation") ||
		message.includes("unsafe operation") ||
		message.includes("blocked by security policy")
	) {
		return ErrorClassification.PERMISSION_ERROR // Using PERMISSION_ERROR as a proxy for security errors
	}

	// Check for search not found errors
	if (
		message.includes("search not found") ||
		message.includes("pattern not found") ||
		message.includes("no match found") ||
		message.includes("could not find")
	) {
		return ErrorClassification.SEARCH_NOT_FOUND
	}

	// Check for multiple matches
	if (
		message.includes("multiple matches") ||
		message.includes("ambiguous match") ||
		message.includes("found multiple occurrences")
	) {
		return ErrorClassification.MULTIPLE_MATCHES
	}

	// Check for AST parse errors
	if (
		message.includes("ast parse error") ||
		message.includes("could not parse ast") ||
		message.includes("invalid ast")
	) {
		return ErrorClassification.AST_PARSE_ERROR
	}

	// Check for syntax errors
	if (
		message.includes("syntax error") ||
		message.includes("parse error") ||
		message.includes("unexpected token") ||
		message.includes("invalid syntax")
	) {
		return ErrorClassification.SYNTAX_ERROR
	}

	// Default to unknown
	return ErrorClassification.UNKNOWN
}

/**
 * Generates a standardized error report
 * @param file - The file path where the error occurred
 * @param classification - The error classification
 * @param message - The error message
 * @param details - Optional additional error details
 * @returns A complete ErrorReport object
 */
export function generateErrorReport(
	file: string,
	classification: ErrorClassification,
	message: string,
	details?: any,
): ErrorReport {
	const errorReport: ErrorReport = {
		file,
		classification,
		severity: getSeverityForClassification(classification),
		message,
		timestamp: new Date(),
		details: {},
	}

	// Add details based on classification
	if (details) {
		if (typeof details === "string") {
			errorReport.details!.context = details
		} else if (typeof details === "object") {
			errorReport.details = {
				...errorReport.details,
				...details,
			}
		}
	}

	// Add specific details based on error type
	switch (classification) {
		case ErrorClassification.ANCHOR_MISMATCH:
			if (details?.anchor) {
				errorReport.details!.anchor = details.anchor
			}
			break

		case ErrorClassification.SEARCH_NOT_FOUND:
			if (details?.searchPattern) {
				errorReport.details!.searchPattern = details.searchPattern
			}
			break

		case ErrorClassification.LINT_ERROR:
		case ErrorClassification.TYPE_ERROR:
			if (details?.originalError) {
				errorReport.details!.originalError = details.originalError
			}
			if (details?.line) {
				errorReport.details!.line = details.line
			}
			if (details?.column) {
				errorReport.details!.column = details.column
			}
			break

		case ErrorClassification.AST_PARSE_ERROR:
			if (details?.selector) {
				errorReport.details!.selector = details.selector
			}
			break
	}

	// Add suggestions based on error type
	errorReport.suggestions = generateBasicSuggestions(classification, details)

	return errorReport
}

/**
 * Generates an actionable remediation plan based on an error report
 * @param errorReport - The error report to generate a plan for
 * @param originalOp - The original patch operation that failed
 * @returns A RemediationPlan with suggested operations and confidence
 */
export function generateRemediationPlan(errorReport: ErrorReport, originalOp?: PatchOp): RemediationPlan {
	const planId = `remediation-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
	const suggestedOps: SuggestedOp[] = []

	// Generate suggestions based on error classification
	switch (errorReport.classification) {
		case ErrorClassification.ALREADY_APPLIED:
			// No action needed
			suggestedOps.push({
				id: `${planId}-noop`,
				op: {
					id: `${planId}-noop-op`,
					strategy: "strict" as any,
					filePath: errorReport.file,
					type: "search_replace",
					search: "",
					replace: "",
				},
				explanation: "The patch was already applied. No action needed.",
				confidence: 1.0,
				isAutoApplicable: true,
			})
			break

		case ErrorClassification.ANCHOR_MISMATCH:
			// Always provide at least one suggestion for anchor mismatch
			suggestedOps.push({
				id: `${planId}-anchor-fix`,
				op: {
					id: `${planId}-anchor-fix-op`,
					strategy: "strict" as any,
					filePath: errorReport.file,
					type: "search_replace",
					search: "",
					replace: "",
				},
				explanation: "Try using a more specific anchor or fuzzy matching.",
				confidence: 0.7,
				isAutoApplicable: false,
				prerequisites: ["Review the anchor text", "Consider using a more unique anchor"],
			})

			if (originalOp && originalOp.type === "anchor") {
				// Suggest alternative anchors
				suggestedOps.push({
					id: `${planId}-fuzzy-anchor`,
					op: {
						...originalOp,
						id: `${planId}-fuzzy-anchor-op`,
						strategy: "fuzzy" as any,
					},
					explanation: "Try using fuzzy matching to locate a similar anchor.",
					confidence: 0.7,
					isAutoApplicable: false,
				})

				// Suggest searching for a partial match
				if (originalOp.anchor.length > 10) {
					suggestedOps.push({
						id: `${planId}-partial-anchor`,
						op: {
							...originalOp,
							id: `${planId}-partial-anchor-op`,
							anchor: originalOp.anchor.substring(0, Math.floor(originalOp.anchor.length / 2)),
						},
						explanation: "Try using a shorter, more unique part of the anchor.",
						confidence: 0.6,
						isAutoApplicable: false,
					})
				}
			}
			break

		case ErrorClassification.LINT_ERROR:
			suggestedOps.push({
				id: `${planId}-lint-fix`,
				op: {
					id: `${planId}-lint-fix-op`,
					strategy: "strict" as any,
					filePath: errorReport.file,
					type: "search_replace",
					search: "",
					replace: "",
				},
				explanation: "Fix the linting errors by adjusting the code to follow linting rules.",
				confidence: 0.8,
				isAutoApplicable: false,
				prerequisites: ["Review lint error details", "Apply appropriate code fixes"],
			})
			break

		case ErrorClassification.TYPE_ERROR:
			suggestedOps.push({
				id: `${planId}-type-fix`,
				op: {
					id: `${planId}-type-fix-op`,
					strategy: "strict" as any,
					filePath: errorReport.file,
					type: "search_replace",
					search: "",
					replace: "",
				},
				explanation: "Fix the type errors by adding proper type annotations or imports.",
				confidence: 0.8,
				isAutoApplicable: false,
				prerequisites: ["Review type error details", "Add missing imports or type annotations"],
			})
			break

		case ErrorClassification.FILE_NOT_FOUND:
			suggestedOps.push({
				id: `${planId}-file-path-fix`,
				op: {
					id: `${planId}-file-path-fix-op`,
					strategy: "strict" as any,
					filePath: errorReport.file,
					type: "search_replace",
					search: "",
					replace: "",
				},
				explanation: "Check if the file path is correct and the file exists.",
				confidence: 0.9,
				isAutoApplicable: false,
				prerequisites: ["Verify file path", "Create file if it does not exist"],
			})
			break

		case ErrorClassification.PERMISSION_ERROR:
			suggestedOps.push({
				id: `${planId}-permission-fix`,
				op: {
					id: `${planId}-permission-fix-op`,
					strategy: "strict" as any,
					filePath: errorReport.file,
					type: "search_replace",
					search: "",
					replace: "",
				},
				explanation: "Fix permission issues by checking file permissions or using a different approach.",
				confidence: 0.7,
				isAutoApplicable: false,
				prerequisites: ["Check file permissions", "Consider alternative approaches"],
			})
			break

		case ErrorClassification.SEARCH_NOT_FOUND:
			// Always provide at least one suggestion for search not found
			suggestedOps.push({
				id: `${planId}-search-fix`,
				op: {
					id: `${planId}-search-fix-op`,
					strategy: "strict" as any,
					filePath: errorReport.file,
					type: "search_replace",
					search: "",
					replace: "",
				},
				explanation: "Try using a more specific search pattern or fuzzy matching.",
				confidence: 0.6,
				isAutoApplicable: false,
				prerequisites: ["Review the search pattern", "Consider using a more unique pattern"],
			})

			if (originalOp && originalOp.type === "search_replace") {
				// Suggest fuzzy matching
				suggestedOps.push({
					id: `${planId}-fuzzy-search`,
					op: {
						...originalOp,
						id: `${planId}-fuzzy-search-op`,
						strategy: "fuzzy" as any,
					},
					explanation: "Try using fuzzy matching to locate similar content.",
					confidence: 0.6,
					isAutoApplicable: false,
				})

				// Suggest using a shorter search pattern
				if (originalOp.search.length > 20) {
					suggestedOps.push({
						id: `${planId}-shorter-search`,
						op: {
							...originalOp,
							id: `${planId}-shorter-search-op`,
							search: originalOp.search.substring(0, Math.floor(originalOp.search.length / 2)),
						},
						explanation: "Try using a shorter, more unique part of the search pattern.",
						confidence: 0.5,
						isAutoApplicable: false,
					})
				}
			}
			break

		default:
			// Generic suggestion for unknown errors
			suggestedOps.push({
				id: `${planId}-generic-fix`,
				op: {
					id: `${planId}-generic-fix-op`,
					strategy: "strict" as any,
					filePath: errorReport.file,
					type: "search_replace",
					search: "",
					replace: "",
				},
				explanation: "Review the error and try a different approach.",
				confidence: 0.3,
				isAutoApplicable: false,
			})
	}

	// Calculate overall confidence
	const confidence = suggestedOps.length > 0 ? Math.max(...suggestedOps.map((op) => op.confidence)) : 0.1

	return {
		id: planId,
		taskId: errorReport.taskId || "unknown",
		errors: [errorReport],
		suggestedOps,
		confidence,
		description: generateRemediationDescription(errorReport, suggestedOps),
		strategy: RemediationStrategy.FIRST_SUCCESS,
		estimatedTimeMs: suggestedOps.length * 1000, // Estimate 1 second per suggestion
		requiresConfirmation: confidence < 0.8,
		metadata: {
			generatedAt: new Date(),
			generatedBy: "SmartPatcher-Classifier",
			version: "1.0.0",
		},
	}
}

/**
 * Analyzes a patch result to determine classification and generate reports
 * @param result - The patch result to analyze
 * @returns Object with classification and optional error report and remediation plan
 */
export function classifyPatchResult(result: PatchResult): {
	classification: ErrorClassification
	errorReport?: ErrorReport
	remediationPlan?: RemediationPlan
} {
	// Handle success cases
	if (result.outcome === PatchOutcome.SUCCESS) {
		return {
			classification: ErrorClassification.ALREADY_APPLIED, // Using this as a success indicator
		}
	}

	// Handle failure cases
	if (result.outcome === PatchOutcome.FAILURE && result.error) {
		const classification = classifyToolMessage(result.error)
		const errorReport = generateErrorReport(
			"", // File path would need to be determined from the operation
			classification,
			result.error,
		)

		const remediationPlan = generateRemediationPlan(errorReport)

		return {
			classification,
			errorReport,
			remediationPlan,
		}
	}

	// Default case
	return {
		classification: ErrorClassification.UNKNOWN,
	}
}

/**
 * Extracts relevant details from different error types
 * @param error - The error to extract details from
 * @returns Structured details object
 */
export function extractErrorDetails(error: Error): any {
	const details: any = {
		name: error.name,
		message: error.message,
	}

	// Add stack trace if available
	if (error.stack) {
		details.stackTrace = error.stack
	}

	// Parse TypeScript errors
	if (error.message.includes("error TS")) {
		const tsMatch = error.message.match(/error TS(\d+):\s*(.+?)(?:\n|$)/)
		if (tsMatch) {
			details.tsCode = tsMatch[1]
			details.tsMessage = tsMatch[2]

			// Try to extract line and column
			const lineColMatch = error.message.match(/\((\d+),(\d+)\)/)
			if (lineColMatch) {
				details.line = parseInt(lineColMatch[1]!, 10)
				details.column = parseInt(lineColMatch[2]!, 10)
			}
		}
	}

	// Parse ESLint errors
	if (
		error.message.includes("eslint") ||
		error.message.includes("lint") ||
		/\d+:\d+\s+(error|warning)/.test(error.message)
	) {
		const eslintMatch = error.message.match(/(\d+):(\d+)\s+(error|warning)\s+(.+?)(?:\n|$)/)
		if (eslintMatch) {
			details.line = parseInt(eslintMatch[1]!, 10)
			details.column = parseInt(eslintMatch[2]!, 10)
			details.severity = eslintMatch[3]
			details.rule = eslintMatch[4]
		} else {
			// Try a different pattern for ESLint errors
			const eslintMatch2 = error.message.match(/(\d+):(\d+)\s+(error|warning)\s+(.+)/)
			if (eslintMatch2) {
				details.line = parseInt(eslintMatch2[1]!, 10)
				details.column = parseInt(eslintMatch2[2]!, 10)
				details.severity = eslintMatch2[3]
				details.rule = eslintMatch2[4]
			} else {
				// Try a simpler pattern for line:column format
				const lineColMatch = error.message.match(/(\d+):(\d+)/)
				if (lineColMatch) {
					details.line = parseInt(lineColMatch[1]!, 10)
					details.column = parseInt(lineColMatch[2]!, 10)
				}
			}
		}
	}

	// Parse file system errors
	if (error.message.includes("ENOENT")) {
		details.code = "ENOENT"
		details.type = "file_not_found"

		// Try to extract file path
		const pathMatch = error.message.match(/'([^']+)'/)
		if (pathMatch) {
			details.filePath = pathMatch[1]
		}
	}

	if (error.message.includes("EACCES")) {
		details.code = "EACCES"
		details.type = "permission_denied"

		// Try to extract file path
		const pathMatch = error.message.match(/'([^']+)'/)
		if (pathMatch) {
			details.filePath = pathMatch[1]
		}
	}

	return details
}

/**
 * Helper function to get severity level for a classification
 * @param classification - The error classification
 * @returns The appropriate ErrorSeverity level
 */
function getSeverityForClassification(classification: ErrorClassification): ErrorSeverity {
	switch (classification) {
		case ErrorClassification.ALREADY_APPLIED:
			return ErrorSeverity.INFO

		case ErrorClassification.LINT_ERROR:
			return ErrorSeverity.WARNING

		case ErrorClassification.TYPE_ERROR:
		case ErrorClassification.SYNTAX_ERROR:
		case ErrorClassification.AST_PARSE_ERROR:
		case ErrorClassification.FILE_NOT_FOUND:
		case ErrorClassification.PERMISSION_ERROR:
			return ErrorSeverity.ERROR

		case ErrorClassification.ANCHOR_MISMATCH:
		case ErrorClassification.SEARCH_NOT_FOUND:
		case ErrorClassification.MULTIPLE_MATCHES:
			return ErrorSeverity.ERROR

		case ErrorClassification.TIMEOUT:
		case ErrorClassification.RETRY_EXCEEDED:
			return ErrorSeverity.ERROR

		default:
			return ErrorSeverity.ERROR
	}
}

/**
 * Helper function to generate basic suggestions based on error classification
 * @param classification - The error classification
 * @param details - Optional error details
 * @returns Array of suggestion strings
 */
function generateBasicSuggestions(classification: ErrorClassification, details?: any): string[] {
	const suggestions: string[] = []

	switch (classification) {
		case ErrorClassification.ALREADY_APPLIED:
			suggestions.push("No action needed - the patch was already applied")
			break

		case ErrorClassification.ANCHOR_MISMATCH:
			suggestions.push("Try using a more specific anchor")
			suggestions.push("Consider using fuzzy matching")
			suggestions.push("Check if the code has changed since the anchor was identified")
			break

		case ErrorClassification.LINT_ERROR:
			suggestions.push("Fix the linting errors manually")
			suggestions.push("Consider disabling the specific lint rule if appropriate")
			suggestions.push("Run the linter with --fix to automatically fix some issues")
			break

		case ErrorClassification.TYPE_ERROR:
			suggestions.push("Add missing type annotations")
			suggestions.push("Import missing types or interfaces")
			suggestions.push("Check for typos in variable or property names")
			break

		case ErrorClassification.FILE_NOT_FOUND:
			suggestions.push("Verify the file path is correct")
			suggestions.push("Check if the file exists in the expected location")
			suggestions.push("Consider creating the file if it does not exist")
			break

		case ErrorClassification.PERMISSION_ERROR:
			suggestions.push("Check file and directory permissions")
			suggestions.push("Try running with elevated privileges if appropriate")
			suggestions.push("Consider using a different file location")
			break

		case ErrorClassification.SEARCH_NOT_FOUND:
			suggestions.push("Verify the search pattern is correct")
			suggestions.push("Check if the code has changed since the pattern was identified")
			suggestions.push("Try using a shorter or more specific search pattern")
			break

		case ErrorClassification.MULTIPLE_MATCHES:
			suggestions.push("Use a more specific search pattern")
			suggestions.push("Include more context to make the match unique")
			suggestions.push("Consider using line numbers to narrow down the match")
			break

		case ErrorClassification.TIMEOUT:
			suggestions.push("Try again with a longer timeout")
			suggestions.push("Check if the system is under heavy load")
			suggestions.push("Consider breaking down the operation into smaller parts")
			break

		default:
			suggestions.push("Review the error message for more details")
			suggestions.push("Try a different approach to the operation")
	}

	return suggestions
}

/**
 * Helper function to generate a remediation plan description
 * @param errorReport - The error report
 * @param suggestedOps - The suggested operations
 * @returns A human-readable description of the remediation plan
 */
function generateRemediationDescription(errorReport: ErrorReport, suggestedOps: SuggestedOp[]): string {
	const classification = errorReport.classification
	const count = suggestedOps.length

	switch (classification) {
		case ErrorClassification.ALREADY_APPLIED:
			return "No remediation needed - the patch was already applied."

		case ErrorClassification.ANCHOR_MISMATCH:
			return `Generated ${count} suggestion${count > 1 ? "s" : ""} to fix anchor mismatch issues.`

		case ErrorClassification.LINT_ERROR:
			return `Generated ${count} suggestion${count > 1 ? "s" : ""} to fix linting errors.`

		case ErrorClassification.TYPE_ERROR:
			return `Generated ${count} suggestion${count > 1 ? "s" : ""} to fix type errors.`

		case ErrorClassification.FILE_NOT_FOUND:
			return `Generated ${count} suggestion${count > 1 ? "s" : ""} to resolve file not found issues.`

		case ErrorClassification.PERMISSION_ERROR:
			return `Generated ${count} suggestion${count > 1 ? "s" : ""} to resolve permission issues.`

		case ErrorClassification.SEARCH_NOT_FOUND:
			return `Generated ${count} suggestion${count > 1 ? "s" : ""} to fix search pattern issues.`

		default:
			return `Generated ${count} suggestion${count > 1 ? "s" : ""} to address the error.`
	}
}

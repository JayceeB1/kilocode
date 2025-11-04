/**
 * Error reporting and classification for the Smart Patcher
 */

/**
 * Error classification enumeration
 */
export enum ErrorClassification {
	/** The patch was already applied */
	ALREADY_APPLIED = "already_applied",
	/** Anchor text could not be found */
	ANCHOR_MISMATCH = "anchor_mismatch",
	/** Linting errors after patching */
	LINT_ERROR = "lint_error",
	/** Type checking errors after patching */
	TYPE_ERROR = "type_error",
	/** Search pattern could not be found */
	SEARCH_NOT_FOUND = "search_not_found",
	/** Multiple matches for search pattern */
	MULTIPLE_MATCHES = "multiple_matches",
	/** File access permissions error */
	PERMISSION_ERROR = "permission_error",
	/** File does not exist */
	FILE_NOT_FOUND = "file_not_found",
	/** Syntax error in patch */
	SYNTAX_ERROR = "syntax_error",
	/** AST parsing error */
	AST_PARSE_ERROR = "ast_parse_error",
	/** Time budget exceeded */
	TIMEOUT = "timeout",
	/** Retry limit exceeded */
	RETRY_EXCEEDED = "retry_exceeded",
	/** Unknown or unexpected error */
	UNKNOWN = "unknown",
}

/**
 * Error severity levels
 */
export enum ErrorSeverity {
	/** Error prevents patch application */
	ERROR = "error",
	/** Warning that might indicate issues */
	WARNING = "warning",
	/** Informational message */
	INFO = "info",
}

/**
 * Detailed error report for patch operations
 */
export interface ErrorReport {
	/** File path where the error occurred */
	file: string
	/** Classification of the error */
	classification: ErrorClassification
	/** Severity level of the error */
	severity: ErrorSeverity
	/** Human-readable error message */
	message: string
	/** Detailed error information */
	details?: {
		/** Line number where the error occurred */
		line?: number
		/** Column number where the error occurred */
		column?: number
		/** The operation that failed */
		operation?: string
		/** The search pattern that failed */
		searchPattern?: string
		/** The anchor that failed */
		anchor?: string
		/** The selector that failed */
		selector?: string
		/** Original error from tools (lint, type checker, etc.) */
		originalError?: string
		/** Stack trace if available */
		stackTrace?: string
		/** Additional context */
		context?: string
	}
	/** Suggested remediation steps */
	suggestions?: string[]
	/** Timestamp when the error occurred */
	timestamp?: Date
	/** ID of the patch operation that failed */
	operationId?: string
	/** ID of the task that contained the failed operation */
	taskId?: string
}

/**
 * Collection of error reports
 */
export interface ErrorReportCollection {
	/** ID of the associated task */
	taskId: string
	/** Array of error reports */
	errors: ErrorReport[]
	/** Summary statistics */
	summary: {
		total: number
		errors: number
		warnings: number
		info: number
		/** Count of errors by classification */
		byClassification: Record<ErrorClassification, number>
	}
	/** Timestamp when the report was generated */
	generatedAt: Date
}

/**
 * Error context for better error handling
 */
export interface ErrorContext {
	/** Current file being processed */
	currentFile?: string
	/** Current operation being executed */
	currentOperation?: string
	/** Files that have been successfully processed */
	processedFiles: string[]
	/** Files that are pending processing */
	pendingFiles: string[]
	/** Current retry count */
	retryCount: number
	/** Elapsed time in milliseconds */
	elapsedTimeMs: number
	/** Remaining time budget in milliseconds */
	remainingTimeMs: number
}

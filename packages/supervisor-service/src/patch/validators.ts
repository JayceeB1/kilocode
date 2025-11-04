/**
 * Validation utilities for patch plans and task envelopes
 */

import { PatchPlan, PatchOp, SearchReplaceOp, AnchorOp, AstOp, PatchStrategy } from "./types.js"
import { TaskEnvelope, TaskScope } from "../contracts/task-envelope.js"

/**
 * Result of a validation operation
 */
export interface ValidationResult {
	/** Whether the validation passed */
	isValid: boolean
	/** Array of error messages if validation failed */
	errors: string[]
}

/**
 * Validates a patch plan structure and content
 * @param plan - The patch plan to validate
 * @returns ValidationResult indicating if the plan is valid
 */
export function validatePatchPlan(plan: PatchPlan): ValidationResult {
	const errors: string[] = []

	// Check if plan is an object
	if (!plan || typeof plan !== "object") {
		errors.push("Patch plan must be an object")
		return { isValid: false, errors }
	}

	// Check required id field
	if (!plan.id || typeof plan.id !== "string") {
		errors.push("Patch plan must have a valid id string")
	}

	// Check ops array
	if (!Array.isArray(plan.ops)) {
		errors.push("Patch plan must have an ops array")
		return { isValid: false, errors }
	}

	// Validate each operation
	plan.ops.forEach((op: PatchOp, index: number) => {
		const opResult = validateOperation(op)
		if (!opResult.isValid) {
			errors.push(`Operation at index ${index}: ${opResult.errors.join(", ")}`)
		}
	})

	// Validate metadata if present
	if (plan.metadata) {
		if (typeof plan.metadata !== "object") {
			errors.push("Metadata must be an object if provided")
		} else {
			if (plan.metadata.description && typeof plan.metadata.description !== "string") {
				errors.push("Metadata description must be a string")
			}
			if (plan.metadata.author && typeof plan.metadata.author !== "string") {
				errors.push("Metadata author must be a string")
			}
			if (plan.metadata.version && typeof plan.metadata.version !== "string") {
				errors.push("Metadata version must be a string")
			}
		}
	}

	return {
		isValid: errors.length === 0,
		errors,
	}
}

/**
 * Validates a task envelope structure and content
 * @param envelope - The task envelope to validate
 * @returns ValidationResult indicating if the envelope is valid
 */
export function validateTaskEnvelope(envelope: TaskEnvelope): ValidationResult {
	const errors: string[] = []

	// Check if envelope is an object
	if (!envelope || typeof envelope !== "object") {
		errors.push("Task envelope must be an object")
		return { isValid: false, errors }
	}

	// Check required id field
	if (!envelope.id || typeof envelope.id !== "string") {
		errors.push("Task envelope must have a valid id string")
	}

	// Validate scope
	if (!envelope.scope) {
		errors.push("Task envelope must have a scope object")
	} else {
		const scopeResult = validateTaskScope(envelope.scope)
		if (!scopeResult.isValid) {
			errors.push(`Scope validation failed: ${scopeResult.errors.join(", ")}`)
		}
	}

	// Validate plan
	if (!envelope.plan) {
		errors.push("Task envelope must have a plan")
	} else {
		const planResult = validatePatchPlan(envelope.plan)
		if (!planResult.isValid) {
			errors.push(`Plan validation failed: ${planResult.errors.join(", ")}`)
		}
	}

	// Validate metadata if present
	if (envelope.metadata) {
		if (typeof envelope.metadata !== "object") {
			errors.push("Metadata must be an object if provided")
		} else {
			if (envelope.metadata.description && typeof envelope.metadata.description !== "string") {
				errors.push("Metadata description must be a string")
			}
			if (envelope.metadata.requester && typeof envelope.metadata.requester !== "string") {
				errors.push("Metadata requester must be a string")
			}
			if (
				envelope.metadata.priority !== undefined &&
				(typeof envelope.metadata.priority !== "number" || envelope.metadata.priority < 0)
			) {
				errors.push("Metadata priority must be a non-negative number")
			}
			if (envelope.metadata.tags && !Array.isArray(envelope.metadata.tags)) {
				errors.push("Metadata tags must be an array")
			}
			if (envelope.metadata.createdAt && !(envelope.metadata.createdAt instanceof Date)) {
				errors.push("Metadata createdAt must be a Date")
			}
			if (envelope.metadata.deadline && !(envelope.metadata.deadline instanceof Date)) {
				errors.push("Metadata deadline must be a Date")
			}
		}
	}

	// Validate options if present
	if (envelope.options) {
		if (typeof envelope.options !== "object") {
			errors.push("Options must be an object if provided")
		} else {
			if (
				envelope.options.continueOnError !== undefined &&
				typeof envelope.options.continueOnError !== "boolean"
			) {
				errors.push("Options continueOnError must be a boolean")
			}
			if (envelope.options.createBackups !== undefined && typeof envelope.options.createBackups !== "boolean") {
				errors.push("Options createBackups must be a boolean")
			}
			if (
				envelope.options.validateBeforeApply !== undefined &&
				typeof envelope.options.validateBeforeApply !== "boolean"
			) {
				errors.push("Options validateBeforeApply must be a boolean")
			}
			if (envelope.options.runLinting !== undefined && typeof envelope.options.runLinting !== "boolean") {
				errors.push("Options runLinting must be a boolean")
			}
			if (
				envelope.options.runTypeChecking !== undefined &&
				typeof envelope.options.runTypeChecking !== "boolean"
			) {
				errors.push("Options runTypeChecking must be a boolean")
			}
		}
	}

	return {
		isValid: errors.length === 0,
		errors,
	}
}

/**
 * Validates a task scope structure and content
 * @param scope - The task scope to validate
 * @returns ValidationResult indicating if the scope is valid
 */
function validateTaskScope(scope: TaskScope): ValidationResult {
	const errors: string[] = []

	// Check if scope is an object
	if (!scope || typeof scope !== "object") {
		errors.push("Task scope must be an object")
		return { isValid: false, errors }
	}

	// Validate allowPaths
	if (!Array.isArray(scope.allowPaths)) {
		errors.push("Scope allowPaths must be an array")
	} else {
		scope.allowPaths.forEach((path: string, index: number) => {
			if (typeof path !== "string") {
				errors.push(`allowPaths[${index}] must be a string`)
			}
		})
	}

	// Validate denyPaths
	if (!Array.isArray(scope.denyPaths)) {
		errors.push("Scope denyPaths must be an array")
	} else {
		scope.denyPaths.forEach((path: string, index: number) => {
			if (typeof path !== "string") {
				errors.push(`denyPaths[${index}] must be a string`)
			}
		})
	}

	// Validate allowOps
	if (!Array.isArray(scope.allowOps)) {
		errors.push("Scope allowOps must be an array")
	} else {
		scope.allowOps.forEach((op: string, index: number) => {
			if (typeof op !== "string") {
				errors.push(`allowOps[${index}] must be a string`)
			}
		})
	}

	// Validate maxRetries
	if (typeof scope.maxRetries !== "number" || scope.maxRetries < 0 || !Number.isInteger(scope.maxRetries)) {
		errors.push("Scope maxRetries must be a non-negative integer")
	}

	// Validate timeBudgetSec
	if (typeof scope.timeBudgetSec !== "number" || scope.timeBudgetSec <= 0 || !Number.isInteger(scope.timeBudgetSec)) {
		errors.push("Scope timeBudgetSec must be a positive integer")
	}

	return {
		isValid: errors.length === 0,
		errors,
	}
}

/**
 * Validates a patch operation structure and content
 * @param op - The patch operation to validate
 * @returns ValidationResult indicating if the operation is valid
 */
export function validateOperation(op: PatchOp): ValidationResult {
	const errors: string[] = []

	// Check if op is an object
	if (!op || typeof op !== "object") {
		errors.push("Operation must be an object")
		return { isValid: false, errors }
	}

	// Check required fields for all operations
	if (!op.id || typeof op.id !== "string") {
		errors.push("Operation must have a valid id string")
	}

	if (!op.strategy || !Object.values(PatchStrategy).includes(op.strategy as PatchStrategy)) {
		errors.push(`Operation must have a valid strategy: ${Object.values(PatchStrategy).join(", ")}`)
	}

	if (!op.filePath || typeof op.filePath !== "string") {
		errors.push("Operation must have a valid filePath string")
	} else {
		// Validate file path
		if (op.filePath.startsWith("/") || op.filePath.startsWith("..")) {
			errors.push("File path must be relative and not contain dangerous patterns")
		}

		// Check for security violations in file path
		const pathViolations = checkSecurityViolations(op.filePath)
		if (pathViolations.length > 0) {
			errors.push(`File path contains security violations: ${pathViolations.join(", ")}`)
		}
	}

	// Validate based on operation type
	if (!op.type) {
		errors.push("Operation must have a type")
	} else {
		switch (op.type) {
			case "search_replace":
				const searchReplaceOp = op as SearchReplaceOp
				if (typeof searchReplaceOp.search !== "string") {
					errors.push("Search operation must have a search string")
				}
				if (typeof searchReplaceOp.replace !== "string") {
					errors.push("Search operation must have a replace string")
				}
				if (
					searchReplaceOp.lineHint !== undefined &&
					(typeof searchReplaceOp.lineHint !== "number" || searchReplaceOp.lineHint < 0)
				) {
					errors.push("Line hint must be a non-negative number")
				}
				break

			case "anchor":
				const anchorOp = op as AnchorOp
				if (typeof anchorOp.anchor !== "string") {
					errors.push("Anchor operation must have an anchor string")
				}
				if (typeof anchorOp.insert !== "string") {
					errors.push("Anchor operation must have an insert string")
				}
				if (!["before", "after"].includes(anchorOp.position)) {
					errors.push('Anchor operation position must be "before" or "after"')
				}
				if (
					anchorOp.offset !== undefined &&
					(typeof anchorOp.offset !== "number" || !Number.isInteger(anchorOp.offset))
				) {
					errors.push("Anchor offset must be an integer")
				}
				break

			case "ast":
				const astOp = op as AstOp
				if (typeof astOp.selector !== "string") {
					errors.push("AST operation must have a selector string")
				}
				if (!["replace", "insert_before", "insert_after", "remove"].includes(astOp.operation)) {
					errors.push("AST operation must be one of: replace, insert_before, insert_after, remove")
				}
				if (astOp.operation !== "remove" && typeof astOp.content !== "string") {
					errors.push("AST operation must have content for non-remove operations")
				}
				break

			default:
				errors.push(`Unknown operation type: ${(op as any).type}`)
		}
	}

	return {
		isValid: errors.length === 0,
		errors,
	}
}

/**
 * Validates if a file path is allowed based on allow and deny patterns
 * @param filePath - The file path to validate
 * @param allowPaths - Array of allowed path patterns
 * @param denyPaths - Array of denied path patterns
 * @returns True if the path is allowed
 */
export function validateFilePath(filePath: string, allowPaths: string[], denyPaths: string[]): boolean {
	// First check if path matches any deny pattern (takes precedence)
	for (const pattern of denyPaths) {
		if (matchesPattern(filePath, pattern)) {
			return false
		}
	}

	// Then check if path matches any allow pattern
	for (const pattern of allowPaths) {
		if (matchesPattern(filePath, pattern)) {
			return true
		}
	}

	// If no allow patterns are specified, allow all paths (except those denied)
	return allowPaths.length === 0
}

/**
 * Validates if an operation type is allowed
 * @param opType - The operation type to validate
 * @param allowOps - Array of allowed operation types
 * @returns True if the operation type is allowed
 */
export function validateOperationType(opType: string, allowOps: string[]): boolean {
	return allowOps.includes(opType)
}

/**
 * Checks content for security violations
 * @param content - The content to check
 * @returns Array of violation descriptions
 */
export function checkSecurityViolations(content: string): string[] {
	const violations: string[] = []

	// Check for 0.0.0.0 binding attempts
	if (content.includes("0.0.0.0") || content.includes("::")) {
		violations.push("Potential binding to all interfaces (0.0.0.0 or ::)")
	}

	// Check for other dangerous patterns
	const dangerousPatterns = [
		{ pattern: /eval\s*\(/, description: "Use of eval() function" },
		{ pattern: /Function\s*\(/, description: "Dynamic function creation" },
		{ pattern: /setTimeout\s*\(/, description: "Use of setTimeout() function" },
		{ pattern: /setInterval\s*\(/, description: "Use of setInterval() function" },
		{ pattern: /document\.write\s*\(/, description: "Use of document.write() function" },
		{ pattern: /innerHTML\s*=/, description: "Direct innerHTML assignment" },
		{ pattern: /outerHTML\s*=/, description: "Direct outerHTML assignment" },
		{ pattern: /exec\s*\(/, description: "Use of exec() function" },
		{ pattern: /system\s*\(/, description: "Use of system() function" },
		{ pattern: /shell_exec\s*\(/, description: "Use of shell_exec() function" },
		{ pattern: /passthru\s*\(/, description: "Use of passthru() function" },
		{ pattern: /child_process/, description: "Use of child_process module" },
		{ pattern: /spawn\s*\(/, description: "Use of spawn() function" },
		{ pattern: /execSync\s*\(/, description: "Use of execSync() function" },
		{ pattern: /require\s*\(\s*['"]child_process/, description: "Requiring child_process module" },
		{ pattern: /import.*child_process/, description: "Importing child_process module" },
		{ pattern: /rm\s+-rf/, description: "Use of rm -rf command" },
		{ pattern: /sudo\s+/, description: "Use of sudo command" },
		{ pattern: /chmod\s+777/, description: "Use of chmod 777 command" },
		{ pattern: /chmod\s+-R/, description: "Use of chmod -R command" },
		{ pattern: /chown\s+/, description: "Use of chown command" },
		{ pattern: />\s*\/dev\/null/, description: "Redirecting to /dev/null" },
		{ pattern: /2>\s*\/dev\/null/, description: "Redirecting stderr to /dev/null" },
		{ pattern: /&>\s*\/dev\/null/, description: "Redirecting all output to /dev/null" },
	]

	for (const { pattern, description } of dangerousPatterns) {
		if (pattern.test(content)) {
			violations.push(description)
		}
	}

	return violations
}

/**
 * Helper function to check if a path matches a pattern
 * Uses simple glob-like pattern matching
 * @param path - The path to check
 * @param pattern - The pattern to match against
 * @returns True if the path matches the pattern
 */
function matchesPattern(path: string, pattern: string): boolean {
	// Handle exact match
	if (pattern === path) {
		return true
	}

	// Handle wildcard "*"
	if (pattern === "*") {
		return true
	}

	// Handle patterns with "**" for directory matching (takes precedence)
	if (pattern.includes("**")) {
		const parts = pattern.split("**")
		if (parts.length === 2) {
			const prefix = parts[0] || ""
			const suffix = parts[1] || ""

			// If prefix is empty, just check if path ends with suffix
			if (!prefix) {
				return path.endsWith(suffix)
			}

			// If suffix is empty, just check if path starts with prefix
			if (!suffix) {
				return path.startsWith(prefix)
			}

			// Check if path starts with prefix and ends with suffix
			return path.startsWith(prefix) && path.endsWith(suffix)
		}
	}

	// Handle patterns ending with "*" (but not "**")
	if (pattern.endsWith("*") && !pattern.endsWith("**")) {
		const prefix = pattern.slice(0, -1)
		return path.startsWith(prefix)
	}

	// Handle patterns starting with "*" (but not "**")
	if (pattern.startsWith("*") && !pattern.startsWith("**")) {
		const suffix = pattern.slice(1)
		return path.endsWith(suffix)
	}

	// Handle patterns with a single "*" in the middle
	if (pattern.includes("*") && !pattern.includes("**")) {
		const parts = pattern.split("*")
		if (parts.length === 2) {
			const prefix = parts[0] || ""
			const suffix = parts[1] || ""

			// If prefix is empty, just check if path ends with suffix
			if (!prefix) {
				return path.endsWith(suffix)
			}

			// If suffix is empty, just check if path starts with prefix
			if (!suffix) {
				return path.startsWith(prefix)
			}

			// Check if path starts with prefix and ends with suffix
			return path.startsWith(prefix) && path.endsWith(suffix)
		}
	}

	return false
}

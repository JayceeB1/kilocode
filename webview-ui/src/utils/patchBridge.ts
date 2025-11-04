import { vscode } from "./vscode"

/**
 * Bridge for reporting patch operations and errors from the UI to the supervisor service
 */

/**
 * Patch execution outcome
 */
export enum PatchOutcome {
	/** Patch was successfully applied */
	SUCCESS = "success",
	/** Patch failed to apply */
	FAILURE = "failure",
	/** Patch was partially applied */
	PARTIAL = "partial",
	/** Patch was skipped */
	SKIPPED = "skipped",
}

/**
 * Patch classification for categorization
 */
export enum PatchClassification {
	/** Bug fix */
	BUGFIX = "bugfix",
	/** New feature */
	FEATURE = "feature",
	/** Refactoring */
	REFACTOR = "refactor",
	/** Documentation */
	DOCS = "docs",
	/** Test */
	TEST = "test",
	/** Configuration */
	CONFIG = "config",
	/** Other */
	OTHER = "other",
}

/**
 * Result of executing a patch operation
 */
export interface PatchResult {
	/** ID of the patch operation */
	opId: string
	/** Outcome of the patch operation */
	outcome: PatchOutcome
	/** Classification of the patch */
	classification: PatchClassification
	/** Hash of the original content */
	originalHash?: string
	/** Hash of the patched content */
	patchedHash?: string
	/** Optional error message if the patch failed */
	error?: string
	/** Optional warnings */
	warnings?: string[]
	/** Line numbers that were modified */
	modifiedLines?: number[]
	/** Execution time in milliseconds */
	executionTimeMs?: number
}

/**
 * Reports an edit error from the UI to the supervisor service.
 *
 * This function sends an error message to the supervisor service using the
 * vscode postMessage infrastructure. The message is sent with type "supervisor:error"
 * and includes the provided payload.
 *
 * @param payload - The error payload to report. Should contain error details
 *                 in a format expected by the supervisor service
 * @throws Error if posting the message fails
 *
 * @example
 * ```typescript
 * try {
 *   // Some operation that might fail
 *   await applyPatch(patchData);
 * } catch (error) {
 *   const errorPayload = createErrorPayload(error, { operation: 'applyPatch' });
 *   reportEditError(errorPayload);
 * }
 * ```
 */
export function reportEditError(payload: any): void {
	try {
		// Type assertion to bypass TypeScript checking for new message types
		;(vscode.postMessage as any)({
			type: "supervisor:error",
			payload,
		})
	} catch (error) {
		console.error("Failed to report edit error:", error)
		throw new Error(`Failed to report edit error: ${error instanceof Error ? error.message : String(error)}`)
	}
}

/**
 * Reports a patch result from the UI to the supervisor service.
 *
 * This function sends a patch result message to the supervisor service using the
 * vscode postMessage infrastructure. The message is sent with type "supervisor:result"
 * and includes the provided patch result data.
 *
 * @param result - The patch result to report. Should contain operation outcome,
 *                 classification, and other relevant metadata
 * @throws Error if posting the message fails
 *
 * @example
 * ```typescript
 * const result: PatchResult = {
 *   opId: 'patch-123',
 *   outcome: PatchOutcome.SUCCESS,
 *   classification: PatchClassification.BUGFIX,
 *   executionTimeMs: 150
 * };
 *
 * reportPatchResult(result);
 * ```
 */
export function reportPatchResult(result: PatchResult): void {
	try {
		// Type assertion to bypass TypeScript checking for new message types
		;(vscode.postMessage as any)({
			type: "supervisor:result",
			payload: result,
		})
	} catch (error) {
		console.error("Failed to report patch result:", error)
		throw new Error(`Failed to report patch result: ${error instanceof Error ? error.message : String(error)}`)
	}
}

/**
 * Creates a standardized error payload for the supervisor service.
 *
 * This helper function formats an error object into a standardized payload
 * that can be sent to the supervisor service. It includes the error message,
 * stack trace, optional context, and a timestamp.
 *
 * @param error - The error object to format
 * @param context - Optional additional context information about when/where
 *                  the error occurred
 * @returns A structured error payload formatted for the supervisor service
 *
 * @example
 * ```typescript
 * try {
 *   await riskyOperation();
 * } catch (error) {
 *   const payload = createErrorPayload(error, {
 *     operation: 'riskyOperation',
 *     filePath: '/path/to/file.ts'
 *   });
 *   reportEditError(payload);
 * }
 * ```
 */
export function createErrorPayload(error: Error, context?: any): any {
	return {
		message: error.message,
		stack: error.stack,
		context: context || {},
		timestamp: new Date().toISOString(),
	}
}

/**
 * Creates a standardized patch result payload for the supervisor service.
 *
 * This helper function formats a patch result into a standardized payload
 * that can be sent to the supervisor service. It includes all the result data
 * plus optional context and a timestamp.
 *
 * @param result - The patch result to format
 * @param context - Optional additional context information about the patch
 *                  operation (e.g., user intent, related files, etc.)
 * @returns A structured patch result payload formatted for the supervisor service
 *
 * @example
 * ```typescript
 * const result: PatchResult = {
 *   opId: 'patch-456',
 *   outcome: PatchOutcome.SUCCESS,
 *   classification: PatchClassification.FEATURE,
 *   modifiedLines: [10, 11, 12]
 * };
 *
 * const payload = createPatchResultPayload(result, {
 *   userIntent: 'Add new feature',
 *   relatedFiles: ['config.ts', 'types.ts']
 * });
 *
 * reportPatchResult(payload);
 * ```
 */
export function createPatchResultPayload(result: PatchResult, context?: any): any {
	return {
		...result,
		context: context || {},
		timestamp: new Date().toISOString(),
	}
}

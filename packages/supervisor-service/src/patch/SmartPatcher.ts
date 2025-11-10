/**
 * SmartPatcher engine with STRICT→FUZZY→AST strategy
 * Provides robust file patching with multiple fallback strategies
 */

import * as crypto from "crypto"
import * as fs from "fs"
import * as path from "path"
import type { PatchPlan, PatchOp, SearchReplaceOp, AnchorOp, AstOp, PatchResult, PatchPlanResult } from "./types.js"
import { PatchOutcome, PatchClassification, PatchStrategy } from "./types.js"
import type { TaskEnvelope } from "../contracts/task-envelope.js"
import { applyAnchorPatch } from "./anchors.js"
import { applyAstPatch } from "./ast.js"

/**
 * SmartPatcher engine that applies patches with multiple strategies
 */
export class SmartPatcher {
	/**
	 * Computes SHA256 hash of the given content
	 * @param content - The content to hash
	 * @returns The SHA256 hash as a hex string
	 */
	private sha256(content: string): string {
		return crypto.createHash("sha256").update(content).digest("hex")
	}

	/**
	 * Applies a strict search and replace operation
	 * @param content - The original content
	 * @param op - The search/replace operation
	 * @returns The modified content or null if operation failed
	 */
	private applyStrict(content: string, op: SearchReplaceOp): string | null {
		try {
			// Check if this is a no-op (search equals replace)
			if (op.search === op.replace) {
				return content // Already applied
			}

			// Check if search string exists in content
			if (!content.includes(op.search)) {
				return null // Search string not found
			}

			// Perform the replacement
			return content.replace(op.search, op.replace)
		} catch (error) {
			console.error("Error in applyStrict:", error)
			return null
		}
	}

	/**
	 * Applies a fuzzy anchor-based operation
	 * @param content - The original content
	 * @param op - The anchor operation
	 * @returns The modified content or null if operation failed
	 */
	private applyFuzzy(content: string, op: AnchorOp): string | null {
		try {
			return applyAnchorPatch(content, op)
		} catch (error) {
			console.error("Error in applyFuzzy:", error)
			return null
		}
	}

	/**
	 * Applies an AST-based operation
	 * @param content - The original content
	 * @param op - The AST operation
	 * @returns The modified content or null if operation failed
	 */
	private applyAst(content: string, op: AstOp): string | null {
		try {
			return applyAstPatch(content, op)
		} catch (error) {
			console.error("Error in applyAst:", error)
			return null
		}
	}

	/**
	 * Applies a patch operation using the appropriate strategy
	 * Implements the STRICT→FUZZY→AST fallback strategy
	 * @param content - The original content
	 * @param op - The patch operation to apply
	 * @returns Object containing the result and the strategy used
	 */
	private applyOperation(content: string, op: PatchOp): { result: string | null; strategy: PatchStrategy } {
		// Try STRICT strategy first for search/replace ops
		if (op.type === "search_replace") {
			const strictResult = this.applyStrict(content, op as SearchReplaceOp)
			if (strictResult !== null) {
				return { result: strictResult, strategy: PatchStrategy.STRICT }
			}
		}

		// Fall through to FUZZY for anchor ops
		if (op.type === "anchor") {
			const fuzzyResult = this.applyFuzzy(content, op as AnchorOp)
			if (fuzzyResult !== null) {
				return { result: fuzzyResult, strategy: PatchStrategy.FUZZY }
			}
		}

		// Fall through to AST for ast ops
		if (op.type === "ast") {
			const astResult = this.applyAst(content, op as AstOp)
			if (astResult !== null) {
				return { result: astResult, strategy: PatchStrategy.AST }
			}
		}

		// If we get here, all strategies failed
		return { result: null, strategy: PatchStrategy.STRICT }
	}

	/**
	 * Checks if a file path is allowed by the task envelope scope
	 * @param filePath - The file path to check
	 * @param envelope - The task envelope containing scope constraints
	 * @returns True if the file path is allowed
	 */
	private isPathAllowed(filePath: string, envelope: TaskEnvelope): boolean {
		const { allowPaths, denyPaths } = envelope.scope
		const resolvedPath = path.resolve(filePath)

		for (const denyPath of denyPaths) {
			if (resolvedPath.startsWith(denyPath)) {
				return false
			}
		}

		if (allowPaths.length === 0) {
			return true
		}

		for (const allowPath of allowPaths) {
			if (resolvedPath.startsWith(allowPath)) {
				return true
			}
		}

		return false
	}

	/**
	 * Checks if an operation type is allowed by the task envelope scope
	 * @param op - The patch operation to check
	 * @param envelope - The task envelope containing scope constraints
	 * @returns True if the operation is allowed
	 */
	private isOpAllowed(op: PatchOp, envelope: TaskEnvelope): boolean {
		const { allowOps } = envelope.scope

		// If no allow ops specified, allow all ops
		if (allowOps.length === 0) {
			return true
		}

		return allowOps.includes(op.type)
	}

	/**
	 * Classifies a patch operation based on its characteristics
	 * @param op - The patch operation to classify
	 * @returns The classification of the operation
	 */
	private classifyOperation(op: PatchOp): PatchClassification {
		// Simple classification based on operation type and content
		if (op.filePath.includes("test") || op.filePath.includes("spec")) {
			return PatchClassification.TEST
		}

		if (op.filePath.includes("doc") || op.filePath.includes("readme")) {
			return PatchClassification.DOCS
		}

		if (op.filePath.includes("config") || op.filePath.includes("setting")) {
			return PatchClassification.CONFIG
		}

		// Default to OTHER for now
		// TODO: Implement more sophisticated classification
		return PatchClassification.OTHER
	}

	/**
	 * Executes a patch plan with comprehensive error handling and reporting
	 * @param plan - The patch plan to execute
	 * @param envelope - The task envelope containing scope and constraints
	 * @param dryRun - Whether to run in dry-run mode (no actual file changes)
	 * @returns Promise resolving to the patch plan result
	 */
	async runPlan(plan: PatchPlan, envelope: TaskEnvelope, dryRun: boolean = false): Promise<PatchPlanResult> {
		const startTime = Date.now()
		const results: PatchResult[] = []

		for (const op of plan.ops) {
			const opStartTime = Date.now()
			let result: PatchResult = {
				opId: op.id,
				outcome: PatchOutcome.FAILURE,
				classification: this.classifyOperation(op),
				executionTimeMs: 0,
			}

			try {
				// Check if operation is allowed by scope
				if (!this.isPathAllowed(op.filePath, envelope)) {
					result.outcome = PatchOutcome.SKIPPED
					result.error = `File path ${op.filePath} not allowed by task scope`
					results.push(result)
					continue
				}

				if (!this.isOpAllowed(op, envelope)) {
					result.outcome = PatchOutcome.SKIPPED
					result.error = `Operation type ${op.type} not allowed by task scope`
					results.push(result)
					continue
				}

				// Read the file content
				const fullPath = path.resolve(op.filePath)
				if (!fs.existsSync(fullPath)) {
					result.outcome = PatchOutcome.FAILURE
					result.error = `File ${op.filePath} does not exist`
					results.push(result)
					continue
				}

				const originalContent = fs.readFileSync(fullPath, "utf-8")
				result.originalHash = this.sha256(originalContent)

				// Apply the operation
				const { result: patchedContent, strategy } = this.applyOperation(originalContent, op)

				if (patchedContent === null) {
					result.outcome = PatchOutcome.FAILURE
					result.error = `All patch strategies failed for operation ${op.id}`
					results.push(result)
					continue
				}

				// Check if content actually changed
				const patchedHash = this.sha256(patchedContent)
				result.patchedHash = patchedHash

				if (result.originalHash === patchedHash) {
					result.outcome = PatchOutcome.SKIPPED
					result.error = `Operation ${op.id} resulted in no changes`
					results.push(result)
					continue
				}

				// Write the file if not in dry-run mode
				if (!dryRun) {
					fs.writeFileSync(fullPath, patchedContent, "utf-8")
				}

				result.outcome = PatchOutcome.SUCCESS
			} catch (error) {
				result.outcome = PatchOutcome.FAILURE
				result.error = error instanceof Error ? error.message : String(error)
			} finally {
				result.executionTimeMs = Date.now() - opStartTime
				results.push(result)
			}
		}

		// Calculate overall outcome and summary
		const totalExecutionTimeMs = Date.now() - startTime
		const summary = {
			total: results.length,
			successful: results.filter((r) => r.outcome === PatchOutcome.SUCCESS).length,
			failed: results.filter((r) => r.outcome === PatchOutcome.FAILURE).length,
			skipped: results.filter((r) => r.outcome === PatchOutcome.SKIPPED).length,
			partial: results.filter((r) => r.outcome === PatchOutcome.PARTIAL).length,
		}

		// Determine overall outcome
		let outcome: PatchOutcome
		if (summary.failed === 0) {
			outcome = PatchOutcome.SUCCESS
		} else if (summary.successful === 0) {
			outcome = PatchOutcome.FAILURE
		} else {
			outcome = PatchOutcome.PARTIAL
		}

		return {
			planId: plan.id,
			outcome,
			results,
			totalExecutionTimeMs,
			summary,
		}
	}
}

/**
 * Patch route for the supervisor service
 * Provides POST /v1/patch endpoint for applying patches
 */

import { Request, Response } from "express"
import { SmartPatcher } from "../patch/SmartPatcher.js"
import { createConservativeEnvelope, applySecurityConstraints } from "../patch/envelope.js"
import type { PatchPlan, PatchPlanResult } from "../patch/types.js"
import type { TaskEnvelope } from "../contracts/task-envelope.js"

/**
 * Patch request interface
 */
export interface PatchRequest {
	/** The patch plan to execute */
	plan: PatchPlan
	/** Optional envelope with security constraints */
	envelope?: Omit<TaskEnvelope, "plan">
	/** Whether to run in dry-run mode (no actual file changes) */
	dryRun?: boolean
}

/**
 * Patch response interface
 */
export interface PatchResponse {
	/** Result of the patch execution */
	result: PatchPlanResult
	/** The envelope that was used for execution */
	envelope: TaskEnvelope
	/** Whether the execution was a dry run */
	dryRun: boolean
}

/**
 * Handles POST /v1/patch requests
 * Executes patch plans using the SmartPatcher with security constraints
 */
export async function handlePatchRequest(req: Request, res: Response): Promise<void> {
	const startTime = Date.now()

	try {
		const rawBody = (req as any)?.body ?? {}
		
		// Validate request body
		if (!rawBody.plan || typeof rawBody.plan !== "object") {
			res.status(400).json({
				error: "Invalid request: plan is required and must be an object",
			})
			return
		}

		const patchRequest: PatchRequest = {
			plan: rawBody.plan,
			envelope: rawBody.envelope,
			dryRun: rawBody.dryRun === true,
		}

		// Validate patch plan structure
		if (!patchRequest.plan.id || !Array.isArray(patchRequest.plan.ops)) {
			res.status(400).json({
				error: "Invalid patch plan: must have id and ops array",
			})
			return
		}

		// Create or use provided envelope
		let envelope: TaskEnvelope
		if (patchRequest.envelope) {
			// Apply security constraints to provided envelope
			const hardenedEnvelope = applySecurityConstraints(patchRequest.envelope)
			envelope = {
				...hardenedEnvelope,
				plan: patchRequest.plan,
			}
		} else {
			// Create conservative envelope
			const conservativeEnvelope = createConservativeEnvelope(patchRequest.plan.id)
			envelope = {
				...conservativeEnvelope,
				plan: patchRequest.plan,
			}
		}

		// Create SmartPatcher instance
		const patcher = new SmartPatcher()

		// Execute the patch plan
		const result = await patcher.runPlan(patchRequest.plan, envelope, patchRequest.dryRun)

		// Prepare response
		const response: PatchResponse = {
			result,
			envelope,
			dryRun: patchRequest.dryRun,
		}

		// Log execution summary
		const executionTime = Date.now() - startTime
		console.log(`Patch execution completed in ${executionTime}ms:`, {
			planId: result.planId,
			outcome: result.outcome,
			total: result.summary.total,
			successful: result.summary.successful,
			failed: result.summary.failed,
			skipped: result.summary.skipped,
			dryRun: patchRequest.dryRun,
		})

		// Return success response
		res.json(response)
	} catch (error) {
		console.error("Patch execution error:", error)
		
		const executionTime = Date.now() - startTime
		res.status(500).json({
			error: "Internal server error during patch execution",
			details: error instanceof Error ? error.message : "Unknown error",
			executionTimeMs: executionTime,
		})
	}
}

/**
 * Validates a patch plan before execution
 * @param plan - The patch plan to validate
 * @returns True if the plan is valid, false otherwise
 */
export function validatePatchPlan(plan: PatchPlan): boolean {
	// Check required fields
	if (!plan.id || typeof plan.id !== "string") {
		return false
	}

	if (!Array.isArray(plan.ops)) {
		return false
	}

	// Validate each operation
	for (const op of plan.ops) {
		if (!op.id || typeof op.id !== "string") {
			return false
		}

		if (!op.filePath || typeof op.filePath !== "string") {
			return false
		}

		if (!op.type || !["search_replace", "anchor", "ast"].includes(op.type)) {
			return false
		}

		// Type-specific validation
		switch (op.type) {
			case "search_replace":
				if (typeof op.search !== "string" || typeof op.replace !== "string") {
					return false
				}
				break

			case "anchor":
				if (typeof op.anchor !== "string" || typeof op.insert !== "string") {
					return false
				}
				if (!["before", "after"].includes(op.position)) {
					return false
				}
				break

			case "ast":
				if (typeof op.selector !== "string" || !["replace", "insert_before", "insert_after", "remove"].includes(op.operation)) {
					return false
				}
				break
		}
	}

	return true
}

/**
 * Middleware to validate patch requests
 */
export function validatePatchMiddleware(req: Request, res: Response, next: Function): void {
	const rawBody = (req as any)?.body ?? {}

	// Check if plan exists
	if (!rawBody.plan || typeof rawBody.plan !== "object") {
		res.status(400).json({
			error: "Invalid request: plan is required and must be an object",
		})
		return
	}

	// Validate patch plan
	if (!validatePatchPlan(rawBody.plan)) {
		res.status(400).json({
			error: "Invalid patch plan: must have valid id and ops array with proper operation structure",
		})
		return
	}

	// Validate envelope if provided
	if (rawBody.envelope && typeof rawBody.envelope === "object") {
		if (rawBody.envelope.scope && typeof rawBody.envelope.scope !== "object") {
			res.status(400).json({
				error: "Invalid envelope: scope must be an object",
			})
			return
		}
	}

	// Validate dryRun
	if (rawBody.dryRun !== undefined && typeof rawBody.dryRun !== "boolean") {
		res.status(400).json({
			error: "Invalid dryRun: must be a boolean",
		})
		return
	}

	next()
}
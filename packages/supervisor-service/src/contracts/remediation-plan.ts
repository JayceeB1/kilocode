/**
 * Remediation plan definitions for the Smart Patcher
 */

import { PatchOp } from "../patch/types.js"
import { ErrorReport } from "./error-report.js"

/**
 * Suggested operation to fix an error
 */
export interface SuggestedOp {
	/** Unique identifier for this suggested operation */
	id: string
	/** The patch operation to apply */
	op: PatchOp
	/** Explanation of why this operation should fix the error */
	explanation: string
	/** Confidence level that this will fix the issue (0-1) */
	confidence: number
	/** Whether this operation is safe to apply automatically */
	isAutoApplicable: boolean
	/** Potential side effects of this operation */
	sideEffects?: string[]
	/** Prerequisites for this operation */
	prerequisites?: string[]
}

/**
 * Remediation strategy enumeration
 */
export enum RemediationStrategy {
	/** Apply the first successful suggestion */
	FIRST_SUCCESS = "first_success",
	/** Apply all suggestions in sequence */
	ALL_SEQUENTIAL = "all_sequential",
	/** Let user choose which suggestion to apply */
	USER_CHOICE = "user_choice",
	/** Apply only high-confidence suggestions */
	HIGH_CONFIDENCE_ONLY = "high_confidence_only",
}

/**
 * Remediation plan for fixing errors
 */
export interface RemediationPlan {
	/** Unique identifier for this remediation plan */
	id: string
	/** ID of the task that generated the errors */
	taskId: string
	/** Array of error reports to fix */
	errors: ErrorReport[]
	/** Array of suggested operations to fix the errors */
	suggestedOps: SuggestedOp[]
	/** Overall confidence in the remediation plan (0-1) */
	confidence: number
	/** Human-readable description of the plan */
	description: string
	/** Strategy to use when applying the remediation */
	strategy: RemediationStrategy
	/** Estimated time to apply the remediation in milliseconds */
	estimatedTimeMs: number
	/** Whether the plan requires user confirmation */
	requiresConfirmation: boolean
	/** Metadata about the plan */
	metadata?: {
		/** When the plan was generated */
		generatedAt: Date
		/** What generated the plan (human, AI, etc.) */
		generatedBy: string
		/** Version of the remediation engine */
		version: string
		/** Tags for categorization */
		tags?: string[]
	}
}

/**
 * Result of applying a remediation plan
 */
export interface RemediationResult {
	/** ID of the remediation plan */
	planId: string
	/** Whether the remediation was successful */
	success: boolean
	/** Results of each suggested operation that was applied */
	opResults: any[] // Will be PatchResult[] when imported
	/** Any remaining errors after remediation */
	remainingErrors: ErrorReport[]
	/** Total time taken to apply the remediation in milliseconds */
	executionTimeMs: number
	/** Optional message about the remediation outcome */
	message?: string
	/** Timestamp when the remediation was completed */
	completedAt: Date
}

/**
 * Remediation options for configuring how remediation plans are generated
 */
export interface RemediationOptions {
	/** Minimum confidence threshold for suggestions */
	minConfidence: number
	/** Maximum number of suggestions to generate per error */
	maxSuggestionsPerError: number
	/** Whether to include risky suggestions */
	includeRiskySuggestions: boolean
	/** Whether to prioritize speed over accuracy */
	prioritizeSpeed: boolean
	/** Custom remediation strategies to try */
	customStrategies?: string[]
	/** Files or patterns to exclude from remediation */
	excludePatterns?: string[]
}

/**
 * Task envelope and scope definitions for the Smart Patcher
 */

/**
 * Task scope defines the boundaries and constraints for a patching task
 */
export interface TaskScope {
	/** Paths that are explicitly allowed for patching */
	allowPaths: string[]
	/** Paths that are explicitly denied for patching */
	denyPaths: string[]
	/** Types of patch operations that are allowed */
	allowOps: string[]
	/** Maximum number of retry attempts for failed operations */
	maxRetries: number
	/** Time budget in seconds for the entire task */
	timeBudgetSec: number
}

/**
 * Task envelope wraps a patch plan with additional metadata and constraints
 */
export interface TaskEnvelope {
	/** Unique identifier for this task */
	id: string
	/** Scope and constraints for this task */
	scope: TaskScope
	/** The patch plan to execute */
	plan: any // Will be PatchPlan when imported
	/** Optional metadata about the task */
	metadata?: {
		/** Human-readable description of the task */
		description?: string
		/** Author or requester of the task */
		requester?: string
		/** Priority level (lower number = higher priority) */
		priority?: number
		/** Tags for categorization */
		tags?: string[]
		/** Creation timestamp */
		createdAt?: Date
		/** Deadline for completion */
		deadline?: Date
	}
	/** Execution options */
	options?: {
		/** Whether to continue on error */
		continueOnError?: boolean
		/** Whether to create backups before patching */
		createBackups?: boolean
		/** Whether to validate patches before applying */
		validateBeforeApply?: boolean
		/** Whether to run linting after patching */
		runLinting?: boolean
		/** Whether to run type checking after patching */
		runTypeChecking?: boolean
	}
}

/**
 * Task status enumeration
 */
export enum TaskStatus {
	/** Task is pending execution */
	PENDING = "pending",
	/** Task is currently running */
	RUNNING = "running",
	/** Task completed successfully */
	COMPLETED = "completed",
	/** Task failed */
	FAILED = "failed",
	/** Task was cancelled */
	CANCELLED = "cancelled",
	/** Task is paused */
	PAUSED = "paused",
}

/**
 * Task execution result
 */
export interface TaskResult {
	/** ID of the task */
	taskId: string
	/** Final status of the task */
	status: TaskStatus
	/** Results of each patch operation */
	patchResults: any[] // Will be PatchResult[] when imported
	/** Total execution time in milliseconds */
	executionTimeMs: number
	/** Optional error message if the task failed */
	error?: string
	/** Optional warnings */
	warnings?: string[]
	/** Timestamp when the task completed */
	completedAt?: Date
}

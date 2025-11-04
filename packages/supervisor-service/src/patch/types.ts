/**
 * Core Smart Patcher types and interfaces
 */

/**
 * Patch strategy enumeration
 */
export enum PatchStrategy {
	/** Strict text-based search and replace */
	STRICT = "strict",
	/** Fuzzy matching with tolerance for minor variations */
	FUZZY = "fuzzy",
	/** AST-based structural patching */
	AST = "ast",
}

/**
 * Base interface for all patch operations
 */
export interface BasePatchOp {
	/** Unique identifier for this operation */
	id: string
	/** Strategy to use for this operation */
	strategy: PatchStrategy
	/** File path relative to workspace root */
	filePath: string
}

/**
 * Search and replace patch operation
 */
export interface SearchReplaceOp extends BasePatchOp {
	type: "search_replace"
	/** Text to search for */
	search: string
	/** Replacement text */
	replace: string
	/** Optional line number hint for more precise matching */
	lineHint?: number
}

/**
 * Anchor-based patch operation
 */
export interface AnchorOp extends BasePatchOp {
	type: "anchor"
	/** Anchor text to locate the patch position */
	anchor: string
	/** Text to insert after the anchor */
	insert: string
	/** Whether to insert before or after the anchor */
	position: "before" | "after"
	/** Optional offset from the anchor */
	offset?: number
}

/**
 * AST-based patch operation
 */
export interface AstOp extends BasePatchOp {
	type: "ast"
	/** AST node selector (e.g., CSS selector, XPath, etc.) */
	selector: string
	/** Operation to perform on the matched node */
	operation: "replace" | "insert_before" | "insert_after" | "remove"
	/** Content for replace/insert operations */
	content?: string
}

/**
 * Union type for all patch operations
 */
export type PatchOp = SearchReplaceOp | AnchorOp | AstOp

/**
 * Patch plan containing multiple operations
 */
export interface PatchPlan {
	/** Unique identifier for this patch plan */
	id: string
	/** Array of patch operations to execute */
	ops: PatchOp[]
	/** Optional metadata about the plan */
	metadata?: {
		description?: string
		author?: string
		version?: string
	}
}

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
 * Result of executing a complete patch plan
 */
export interface PatchPlanResult {
	/** ID of the patch plan */
	planId: string
	/** Overall outcome of the patch plan */
	outcome: PatchOutcome
	/** Results for each operation in the plan */
	results: PatchResult[]
	/** Total execution time in milliseconds */
	totalExecutionTimeMs: number
	/** Summary statistics */
	summary: {
		total: number
		successful: number
		failed: number
		skipped: number
		partial: number
	}
}

/**
 * Conservative envelope module for secure patching
 * Provides default security constraints and envelope hardening
 */

import type { TaskEnvelope, TaskScope } from "../contracts/task-envelope.js"

/**
 * Default conservative envelope with secure defaults
 */
export const DEFAULT_CONSERVATIVE_ENVELOPE: Omit<TaskEnvelope, "plan"> = {
	id: "conservative-default",
	scope: {
		allowPaths: [], // Empty means allow all paths (will be overridden by applySecurityConstraints)
		denyPaths: [
			// System and sensitive directories
			"/etc/",
			"/usr/",
			"/bin/",
			"/sbin/",
			"/boot/",
			"/sys/",
			"/proc/",
			"/dev/",
			// Configuration files
			".env",
			".env.local",
			".env.production",
			"config/secrets",
			"secrets/",
			// Package manager lock files (should be updated by package manager)
			"package-lock.json",
			"yarn.lock",
			"pnpm-lock.yaml",
			// Build artifacts
			"node_modules/",
			"dist/",
			"build/",
			"out/",
			".next/",
			".nuxt/",
			".cache/",
			// Version control
			".git/",
			".svn/",
			".hg/",
			// IDE files
			".vscode/",
			".idea/",
			".vs/",
			// OS files
			".DS_Store",
			"Thumbs.db",
			// Temporary files
			"*.tmp",
			"*.temp",
			"*.swp",
			"*.swo",
		],
		allowOps: ["search_replace", "anchor"], // Allow only safe operations by default
		maxRetries: 3,
		timeBudgetSec: 300, // 5 minutes
	},
	metadata: {
		description: "Conservative security envelope with safe defaults",
		requester: "supervisor-service",
		priority: 5,
		tags: ["conservative", "secure"],
		createdAt: new Date(),
	},
	options: {
		continueOnError: false,
		createBackups: true,
		validateBeforeApply: true,
		runLinting: false,
		runTypeChecking: false,
	},
}

/**
 * Applies security constraints to harden a task envelope
 * @param envelope - The original task envelope
 * @param customConstraints - Optional custom security constraints
 * @returns A hardened task envelope with conservative security settings
 */
export function applySecurityConstraints(
	envelope: Omit<TaskEnvelope, "plan">,
	customConstraints?: Partial<TaskScope>
): TaskEnvelope {
	// Start with conservative defaults
	const hardenedScope: TaskScope = {
		...DEFAULT_CONSERVATIVE_ENVELOPE.scope,
		// Apply custom constraints if provided
		...customConstraints,
		// Ensure deny paths always include critical system paths
		denyPaths: [
			...DEFAULT_CONSERVATIVE_ENVELOPE.scope.denyPaths,
			...(customConstraints?.denyPaths || []),
		],
		// Ensure operation types are safe
		allowOps: customConstraints?.allowOps || DEFAULT_CONSERVATIVE_ENVELOPE.scope.allowOps,
		// Limit retries and time budget for security
		maxRetries: Math.min(
			customConstraints?.maxRetries || DEFAULT_CONSERVATIVE_ENVELOPE.scope.maxRetries,
			5 // Maximum 5 retries
		),
		timeBudgetSec: Math.min(
			customConstraints?.timeBudgetSec || DEFAULT_CONSERVATIVE_ENVELOPE.scope.timeBudgetSec,
			600 // Maximum 10 minutes
		),
	}

	// If no allow paths specified, restrict to current working directory and subdirectories
	if (hardenedScope.allowPaths.length === 0) {
		hardenedScope.allowPaths = [process.cwd() + "/"]
	}

	// Ensure allow paths are absolute and normalized
	hardenedScope.allowPaths = hardenedScope.allowPaths.map(path => {
		const resolved = path.startsWith("/") ? path : process.cwd() + "/" + path
		return resolved.endsWith("/") ? resolved : resolved + "/"
	})

	// Ensure deny paths are absolute and normalized
	hardenedScope.denyPaths = hardenedScope.denyPaths.map(path => {
		const resolved = path.startsWith("/") ? path : process.cwd() + "/" + path
		return resolved.endsWith("/") ? resolved : resolved + "/"
	})

	return {
		...envelope,
		scope: hardenedScope,
		options: {
			...DEFAULT_CONSERVATIVE_ENVELOPE.options,
			...envelope.options,
			// Always enable security-critical options
			createBackups: true,
			validateBeforeApply: true,
		},
	}
}

/**
 * Creates a conservative envelope for a specific patch plan
 * @param planId - The ID of the patch plan
 * @param customConstraints - Optional custom security constraints
 * @returns A conservative task envelope
 */
export function createConservativeEnvelope(
	planId: string,
	customConstraints?: Partial<TaskScope>
): Omit<TaskEnvelope, "plan"> {
	const baseEnvelope = {
		...DEFAULT_CONSERVATIVE_ENVELOPE,
		id: `conservative-${planId}`,
		metadata: {
			...DEFAULT_CONSERVATIVE_ENVELOPE.metadata,
			createdAt: new Date(),
		},
	}

	return applySecurityConstraints(baseEnvelope, customConstraints)
}

/**
 * Validates if a file path is safe for patching
 * @param filePath - The file path to validate
 * @param envelope - The task envelope containing security constraints
 * @returns True if the path is safe, false otherwise
 */
export function isPathSafe(filePath: string, envelope: TaskEnvelope): boolean {
	const { allowPaths, denyPaths } = envelope.scope

	// Normalize the file path
	const normalizedPath = filePath.startsWith("/") ? filePath : process.cwd() + "/" + filePath

	// Check deny paths first
	for (const denyPath of denyPaths) {
		if (normalizedPath.startsWith(denyPath)) {
			return false
		}
	}

	// Check allow paths
	for (const allowPath of allowPaths) {
		if (normalizedPath.startsWith(allowPath)) {
			return true
		}
	}

	// If no allow paths specified, deny by default for security
	return allowPaths.length === 0 ? false : false
}

/**
 * Validates if an operation type is safe
 * @param opType - The operation type to validate
 * @param envelope - The task envelope containing security constraints
 * @returns True if the operation is safe, false otherwise
 */
export function isOperationSafe(opType: string, envelope: TaskEnvelope): boolean {
	const { allowOps } = envelope.scope

	// If no allow ops specified, deny by default for security
	if (allowOps.length === 0) {
		return false
	}

	return allowOps.includes(opType)
}
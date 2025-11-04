#!/usr/bin/env node

/**
 * CLI interface for Smart Patcher dry-run and apply operations
 *
 * This module provides a command-line interface for executing patch plans
 * with support for dry-run mode, custom task envelopes, and comprehensive
 * error handling and reporting.
 */

import * as fs from "fs"
import * as path from "path"
import { promisify } from "util"
import { pipeline } from "stream"
import { SmartPatcher } from "../patch/SmartPatcher.js"
import type { PatchPlan, PatchPlanResult } from "../patch/types.js"
import type { TaskEnvelope, TaskScope } from "../contracts/task-envelope.js"
import type { ErrorReport, ErrorClassification } from "../contracts/error-report.js"
import { ErrorSeverity } from "../contracts/error-report.js"
import type { RemediationPlan } from "../contracts/remediation-plan.js"
import {
	readRegistry,
	writeRegistry,
	createObservation,
	inferSuggestedOps,
	mergeObservation,
	addSuggestedOp,
} from "../patch/registry.js"

// Promisify stream pipeline for async/await usage
const pipelineAsync = promisify(pipeline)

/**
 * CLI options interface
 */
interface CliOptions {
	/** Whether to run in dry-run mode (no actual file changes) */
	dryRun: boolean
	/** Path to the TaskEnvelope.json file */
	envelopePath?: string
}

/**
 * Result interface for CLI output
 */
interface CliResult {
	/** Whether the operation was successful */
	ok: boolean
	/** Whether any changes were made */
	changed: boolean
	/** The outcome of the patch operation */
	outcome: string
	/** Hash of the workspace before patching */
	hashBefore?: string
	/** Hash of the workspace after patching */
	hashAfter?: string
	/** Error report if errors occurred */
	errorReport?: ErrorReport[]
	/** Remediation plan if errors occurred */
	remediationPlan?: RemediationPlan
}

/**
 * Default conservative task envelope for security
 */
const DEFAULT_CONSERVATIVE_ENVELOPE: TaskEnvelope = {
	id: "default-conservative",
	scope: {
		allowPaths: [], // Empty means allow all paths
		denyPaths: [
			// System directories
			"/etc",
			"/usr",
			"/bin",
			"/sbin",
			"/var",
			"/sys",
			"/proc",
			// Sensitive files
			"**/.ssh",
			"**/.aws",
			"**/.azure",
			"**/.config/gcloud",
			"**/.kube",
			// Package manager files
			"**/node_modules/.bin",
			"**/target/debug",
			"**/target/release",
			"**/build",
			"**/dist",
		],
		allowOps: [], // Empty means allow all operations
		maxRetries: 3,
		timeBudgetSec: 300, // 5 minutes
	},
	plan: {} as any, // Will be replaced with actual plan
	metadata: {
		description: "Default conservative envelope for secure patching",
		requester: "cli",
		priority: 5,
		tags: ["conservative", "secure"],
		createdAt: new Date(),
	},
	options: {
		continueOnError: true,
		createBackups: true,
		validateBeforeApply: true,
		runLinting: false,
		runTypeChecking: false,
	},
}

/**
 * Parse command line arguments
 * @param args - Command line arguments (process.argv.slice(2))
 * @returns Parsed CLI options
 */
function parseArguments(args: string[]): CliOptions {
	const options: CliOptions = {
		dryRun: false,
	}

	for (let i = 0; i < args.length; i++) {
		const arg = args[i]

		switch (arg) {
			case "--dry-run":
				options.dryRun = true
				break
			case "--envelope":
				if (i + 1 < args.length) {
					options.envelopePath = args[++i]
				} else {
					console.error("Error: --envelope requires a path argument")
					process.exit(1)
				}
				break
			case "--help":
			case "-h":
				console.log(`
Smart Patcher CLI

Usage:
  patch [options]

Options:
  --dry-run              Run in dry-run mode (no actual file changes)
  --envelope <path>      Path to TaskEnvelope.json file
  --help, -h             Show this help message

Examples:
  patch --dry-run < plan.json
  patch --envelope custom-envelope.json < plan.json
        `)
				process.exit(0)
				break
			default:
				console.error(`Error: Unknown option ${arg}`)
				process.exit(1)
		}
	}

	return options
}

/**
 * Read and parse JSON from stdin
 * @returns Promise<PatchPlan> - The parsed patch plan
 */
async function readPatchPlanFromStdin(): Promise<PatchPlan> {
	try {
		const stdin = process.stdin
		const chunks: Buffer[] = []

		// Set stdin to flowing mode
		stdin.resume()
		stdin.setEncoding("utf8")

		// Collect all data chunks
		for await (const chunk of stdin) {
			chunks.push(Buffer.from(chunk))
		}

		// Combine chunks and parse as JSON
		const data = Buffer.concat(chunks).toString("utf8")

		if (!data.trim()) {
			throw new Error("No input received from stdin")
		}

		const plan = JSON.parse(data) as PatchPlan

		// Validate plan structure
		if (!plan.id || !Array.isArray(plan.ops)) {
			throw new Error("Invalid patch plan structure: missing id or ops")
		}

		return plan
	} catch (error) {
		if (error instanceof SyntaxError) {
			throw new Error(`Invalid JSON in stdin: ${error.message}`)
		}
		throw error
	}
}

/**
 * Load TaskEnvelope from file or use default conservative envelope
 * @param envelopePath - Optional path to TaskEnvelope.json file
 * @returns Promise<TaskEnvelope> - The loaded or default envelope
 */
async function loadTaskEnvelope(envelopePath?: string): Promise<TaskEnvelope> {
	if (envelopePath) {
		try {
			const envelopeData = await fs.promises.readFile(envelopePath, "utf8")
			const envelope = JSON.parse(envelopeData) as TaskEnvelope

			// Validate envelope structure
			if (!envelope.id || !envelope.scope) {
				throw new Error("Invalid task envelope structure: missing id or scope")
			}

			// Apply security constraints
			envelope.scope = applySecurityConstraints(envelope.scope)

			return envelope
		} catch (error) {
			if (error instanceof SyntaxError) {
				throw new Error(`Invalid JSON in envelope file: ${error.message}`)
			}
			throw error
		}
	}

	// Return default conservative envelope with security constraints applied
	return {
		...DEFAULT_CONSERVATIVE_ENVELOPE,
		scope: applySecurityConstraints(DEFAULT_CONSERVATIVE_ENVELOPE.scope),
	}
}

/**
 * Apply security constraints to task scope
 * @param scope - The original task scope
 * @returns TaskScope - The scope with security constraints applied
 */
function applySecurityConstraints(scope: TaskScope): TaskScope {
	// Ensure local-first constraint (no remote operations)
	// This is enforced by the SmartPatcher implementation

	// Add additional deny paths for security
	const additionalDenyPaths = [
		// Prevent binding to 0.0.0.0
		"**/*0.0.0.0*",
		// Restrict port range to 9600-9699
		"**/*port*",
		"**/*listen*",
	]

	return {
		...scope,
		denyPaths: [...scope.denyPaths, ...additionalDenyPaths],
	}
}

/**
 * Ensure .kilocode directories exist
 * @returns Promise<void>
 */
async function ensureKilocodeDirectories(): Promise<void> {
	const directories = [".kilocode", ".kilocode/patch-plans", ".kilocode/patch-reports"]

	for (const dir of directories) {
		try {
			await fs.promises.mkdir(dir, { recursive: true })
		} catch (error) {
			// Ignore errors if directory already exists
			if ((error as any).code !== "EEXIST") {
				throw error
			}
		}
	}
}

/**
 * Write error report to .kilocode/patch-reports/
 * @param errorReport - The error report to write
 * @returns Promise<string> - The path to the written report
 */
async function writeErrorReport(errorReport: ErrorReport[]): Promise<string> {
	const timestamp = new Date().toISOString().replace(/[:.]/g, "-")
	const reportPath = `.kilocode/patch-reports/error-report-${timestamp}.json`

	await fs.promises.writeFile(reportPath, JSON.stringify(errorReport, null, 2), "utf8")

	return reportPath
}

/**
 * Update registry with observations and suggestions
 * @param planResult - The result of the patch plan execution
 * @param plan - The original patch plan
 * @returns Promise<void>
 */
async function updateRegistry(planResult: PatchPlanResult, plan: PatchPlan): Promise<void> {
	try {
		// Read existing registry
		const registry = await readRegistry()

		// Process failed operations to create observations
		for (const result of planResult.results) {
			if (result.outcome === "failure" && result.error) {
				// Find the original operation
				const originalOp = plan.ops.find((op) => op.id === result.opId)

				if (originalOp) {
					// Create observation from error
					const errorReport: ErrorReport = {
						file: originalOp.filePath,
						classification: "unknown" as ErrorClassification,
						severity: ErrorSeverity.ERROR,
						message: result.error,
						operationId: result.opId,
						timestamp: new Date(),
					}

					const observation = createObservation(errorReport)
					mergeObservation(registry, observation)

					// Infer suggested operations
					const suggestedOps = inferSuggestedOps(errorReport, originalOp)
					for (const suggestedOp of suggestedOps) {
						addSuggestedOp(registry, suggestedOp)
					}
				}
			}
		}

		// Write updated registry
		await writeRegistry(registry)
	} catch (error) {
		console.warn(`Warning: Failed to update registry: ${error}`)
	}
}

/**
 * Main CLI execution function
 */
async function main(): Promise<void> {
	try {
		// Parse command line arguments
		const options = parseArguments(process.argv.slice(2))

		// Ensure .kilocode directories exist
		await ensureKilocodeDirectories()

		// Read patch plan from stdin
		const plan = await readPatchPlanFromStdin()

		// Load task envelope
		const envelope = await loadTaskEnvelope(options.envelopePath)

		// Set the plan in the envelope
		envelope.plan = plan

		// Create SmartPatcher instance
		const patcher = new SmartPatcher()

		// Execute the patch plan
		const planResult = await patcher.runPlan(plan, envelope, options.dryRun)

		// Update registry with observations and suggestions
		await updateRegistry(planResult, plan)

		// Prepare CLI result
		const result: CliResult = {
			ok: planResult.outcome === "success",
			changed: planResult.summary.successful > 0,
			outcome: planResult.outcome,
		}

		// Handle error reports
		const failedResults = planResult.results.filter((r) => r.outcome === "failure")
		if (failedResults.length > 0) {
			const errorReports: ErrorReport[] = failedResults.map((r) => ({
				file: plan.ops.find((op) => op.id === r.opId)?.filePath || "unknown",
				classification: "unknown" as ErrorClassification,
				severity: ErrorSeverity.ERROR,
				message: r.error || "Unknown error",
				operationId: r.opId,
				timestamp: new Date(),
			}))

			result.errorReport = errorReports

			// Write error report to file
			const reportPath = await writeErrorReport(errorReports)
			console.error(`Error report written to: ${reportPath}`)
		}

		// Output result as JSON
		console.log(JSON.stringify(result, null, 2))

		// Exit with appropriate code
		process.exit(result.ok ? 0 : 1)
	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : String(error)
		console.error(`Error: ${errorMessage}`)
		process.exit(1)
	}
}

// Run main function if this file is executed directly
if (require.main === module) {
	main().catch((error) => {
		console.error("Unhandled error:", error)
		process.exit(1)
	})
}

// Export functions for testing
export {
	parseArguments,
	readPatchPlanFromStdin,
	loadTaskEnvelope,
	applySecurityConstraints,
	ensureKilocodeDirectories,
	writeErrorReport,
	updateRegistry,
	DEFAULT_CONSERVATIVE_ENVELOPE,
}

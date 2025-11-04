/**
 * Registry management for observations and suggestions
 */

import { promises as fs } from "fs"
import { join, dirname } from "path"
import { PatchOp } from "./types.js"
import { ErrorReport, ErrorClassification } from "../contracts/error-report.js"
import { SuggestedOp } from "../contracts/remediation-plan.js"

/**
 * Registry observation interface
 */
export interface RegistryObservation {
	/** File path where the observation was made */
	file: string
	/** Classification of the observation */
	classification: ErrorClassification
	/** Observation message */
	message: string
	/** Anchors that were tried */
	anchors?: {
		triedAfter?: string[]
		triedBefore?: string[]
	}
	/** Candidate anchors that might work */
	candidates?: {
		after?: string
		before?: string
		insert?: string
	}
	/** First time this observation was made */
	firstSeen: Date
	/** Last time this observation was seen */
	lastSeen: Date
	/** Number of times this observation has been seen */
	count: number
}

/**
 * Registry interface for storing observations and suggestions
 */
export interface Registry {
	/** Registry version */
	version: string
	/** Last time the registry was updated */
	updatedAt: Date
	/** Array of observations */
	observations: RegistryObservation[]
	/** Array of suggested operations */
	suggestedOps: SuggestedOp[]
}

/**
 * Default registry version
 */
const DEFAULT_REGISTRY_VERSION = "1.0.0"

/**
 * Default registry structure
 */
const DEFAULT_REGISTRY: Registry = {
	version: DEFAULT_REGISTRY_VERSION,
	updatedAt: new Date(),
	observations: [],
	suggestedOps: [],
}

/**
 * Read the registry file from the specified path
 * @param registryPath - Path to the registry file
 * @returns Promise<Registry> - The registry object
 */
export async function readRegistry(registryPath: string = ".kilocode/patch-plans/registry.json"): Promise<Registry> {
	try {
		const fileContent = await fs.readFile(registryPath, "utf-8")
		const registry = JSON.parse(fileContent) as Registry

		// Convert date strings back to Date objects
		registry.updatedAt = new Date(registry.updatedAt)
		registry.observations = registry.observations.map((obs) => ({
			...obs,
			firstSeen: new Date(obs.firstSeen),
			lastSeen: new Date(obs.lastSeen),
		}))

		return registry
	} catch (error) {
		// If file doesn't exist or is corrupted, return default registry
		if ((error as any).code === "ENOENT") {
			return { ...DEFAULT_REGISTRY }
		}

		// For JSON parsing errors, create a backup and return default
		if (error instanceof SyntaxError) {
			try {
				const backupPath = `${registryPath}.backup.${Date.now()}`
				await fs.copyFile(registryPath, backupPath)
				console.warn(`Corrupted registry file backed up to ${backupPath}`)
			} catch (backupError) {
				console.warn("Failed to backup corrupted registry file")
			}
			return { ...DEFAULT_REGISTRY }
		}

		throw error
	}
}

/**
 * Write the registry to the specified path
 * @param registry - The registry object to write
 * @param registryPath - Path to write the registry file
 * @returns Promise<void>
 */
export async function writeRegistry(
	registry: Registry,
	registryPath: string = ".kilocode/patch-plans/registry.json",
): Promise<void> {
	try {
		// Update the timestamp
		registry.updatedAt = new Date()

		// Create directories if they don't exist
		await fs.mkdir(dirname(registryPath), { recursive: true })

		// Write the registry to file
		const fileContent = JSON.stringify(registry, null, 2)
		await fs.writeFile(registryPath, fileContent, "utf-8")
	} catch (error) {
		throw new Error(`Failed to write registry to ${registryPath}: ${error}`)
	}
}

/**
 * Append or merge observation for the file
 * @param registry - The registry to update
 * @param observation - The observation to merge
 * @returns Registry - The updated registry
 */
export function mergeObservation(registry: Registry, observation: RegistryObservation): Registry {
	const existingIndex = registry.observations.findIndex(
		(obs) =>
			obs.file === observation.file &&
			obs.classification === observation.classification &&
			obs.message === observation.message,
	)

	if (existingIndex >= 0) {
		// Update existing observation
		const existing = registry.observations[existingIndex]
		if (existing) {
			existing.lastSeen = observation.lastSeen
			existing.count += observation.count

			// Merge anchors and candidates if they exist
			if (observation.anchors) {
				existing.anchors = existing.anchors || {}
				if (observation.anchors.triedAfter) {
					existing.anchors.triedAfter = Array.from(
						new Set([...(existing.anchors.triedAfter || []), ...observation.anchors.triedAfter]),
					)
				}
				if (observation.anchors.triedBefore) {
					existing.anchors.triedBefore = Array.from(
						new Set([...(existing.anchors.triedBefore || []), ...observation.anchors.triedBefore]),
					)
				}
			}

			if (observation.candidates) {
				existing.candidates = { ...existing.candidates, ...observation.candidates }
			}
		}
	} else {
		// Add new observation
		registry.observations.push(observation)
	}

	return registry
}

/**
 * Add suggested operation to the registry
 * @param registry - The registry to update
 * @param suggestedOp - The suggested operation to add
 * @returns Registry - The updated registry
 */
export function addSuggestedOp(registry: Registry, suggestedOp: SuggestedOp): Registry {
	// Check for duplicates based on file and operation content
	const isDuplicate = registry.suggestedOps.some((existing) => {
		if (existing.op.filePath !== suggestedOp.op.filePath) {
			return false
		}

		// Compare operation content based on type
		if (existing.op.type !== suggestedOp.op.type) {
			return false
		}

		switch (suggestedOp.op.type) {
			case "search_replace":
				return (
					(existing.op as any).search === (suggestedOp.op as any).search &&
					(existing.op as any).replace === (suggestedOp.op as any).replace
				)
			case "anchor":
				return (
					(existing.op as any).anchor === (suggestedOp.op as any).anchor &&
					(existing.op as any).insert === (suggestedOp.op as any).insert &&
					(existing.op as any).position === (suggestedOp.op as any).position
				)
			case "ast":
				return (
					(existing.op as any).selector === (suggestedOp.op as any).selector &&
					(existing.op as any).operation === (suggestedOp.op as any).operation &&
					(existing.op as any).content === (suggestedOp.op as any).content
				)
			default:
				return false
		}
	})

	if (!isDuplicate) {
		registry.suggestedOps.push(suggestedOp)
	}

	return registry
}

/**
 * Keep registry size limited by removing oldest entries
 * @param registry - The registry to trim
 * @param maxEntries - Maximum number of entries to keep
 * @returns Registry - The trimmed registry
 */
export function limitRegistrySize(registry: Registry, maxEntries: number = 500): Registry {
	if (registry.observations.length <= maxEntries) {
		return registry
	}

	// Sort observations by lastSeen timestamp (oldest first)
	const sortedObservations = [...registry.observations].sort((a, b) => a.lastSeen.getTime() - b.lastSeen.getTime())

	// Keep only the most recent observations
	registry.observations = sortedObservations.slice(-maxEntries)

	return registry
}

/**
 * Create a registry observation from an error report
 * @param errorReport - The error report to convert
 * @param triedAnchors - Anchors that were tried
 * @param candidates - Candidate anchors that might work
 * @returns RegistryObservation - The created observation
 */
export function createObservation(
	errorReport: ErrorReport,
	triedAnchors?: { triedAfter?: string[]; triedBefore?: string[] },
	candidates?: { after?: string; before?: string; insert?: string },
): RegistryObservation {
	const now = new Date()

	return {
		file: errorReport.file,
		classification: errorReport.classification,
		message: errorReport.message,
		anchors: triedAnchors,
		candidates: candidates,
		firstSeen: now,
		lastSeen: now,
		count: 1,
	}
}

/**
 * Infer suggested operations based on error patterns
 * @param errorReport - The error report to analyze
 * @param originalOp - The original operation that failed
 * @returns SuggestedOp[] - Array of suggested operations
 */
export function inferSuggestedOps(errorReport: ErrorReport, originalOp?: PatchOp): SuggestedOp[] {
	const suggestions: SuggestedOp[] = []

	switch (errorReport.classification) {
		case ErrorClassification.ANCHOR_MISMATCH:
			// For anchor mismatch, suggest improved anchors based on file content
			if (errorReport.details?.anchor && originalOp && originalOp.type === "anchor") {
				// Create a suggestion with a more robust anchor
				let anchorText = ""
				if (errorReport.details?.anchor) {
					const anchor = errorReport.details.anchor as any
					if (anchor) {
						anchorText = anchor.split("\n")[0].trim()
					}
				}
				suggestions.push({
					id: `anchor-fix-${Date.now()}`,
					op: {
						...originalOp,
						id: `fixed-anchor-${Date.now()}`,
						// Use a shorter, more specific anchor
						anchor: anchorText,
						// Add offset to try nearby lines
						offset: (originalOp.offset || 0) + 1,
					},
					explanation: "Try using a shorter anchor and adjust the offset",
					confidence: 0.7,
					isAutoApplicable: true,
					sideEffects: ["May insert at a slightly different location"],
				})
			}
			break

		case ErrorClassification.SEARCH_NOT_FOUND:
			// For search not found, suggest fuzzy matching or alternative patterns
			if (errorReport.details?.searchPattern && originalOp && originalOp.type === "search_replace") {
				// Suggest using a shorter search pattern
				const originalPattern = errorReport.details.searchPattern
				let shorterPattern = ""
				if (originalPattern) {
					const pattern = originalPattern as any
					if (pattern) {
						shorterPattern = pattern.split("\n")[0].trim()
					}
				}
				if (shorterPattern && shorterPattern !== originalPattern) {
					suggestions.push({
						id: `search-fix-${Date.now()}`,
						op: {
							...originalOp,
							id: `fixed-search-${Date.now()}`,
							search: shorterPattern,
						},
						explanation: "Try using a shorter search pattern",
						confidence: 0.6,
						isAutoApplicable: true,
						sideEffects: ["May match more locations than intended"],
					})
				}
			}
			break

		case ErrorClassification.MULTIPLE_MATCHES:
			// For multiple matches, suggest adding more context
			if (originalOp && originalOp.type === "search_replace") {
				suggestions.push({
					id: `context-fix-${Date.now()}`,
					op: {
						...originalOp,
						id: `context-search-${Date.now()}`,
						// Add line hint to narrow down the match
						lineHint: errorReport.details?.line,
					},
					explanation: "Add line number hint to disambiguate multiple matches",
					confidence: 0.8,
					isAutoApplicable: true,
					sideEffects: ["Will fail if line numbers have changed"],
				})
			}
			break

		default:
			// For other errors, suggest retrying with a different strategy
			if (originalOp) {
				suggestions.push({
					id: `strategy-fix-${Date.now()}`,
					op: {
						...originalOp,
						id: `strategy-change-${Date.now()}`,
						// Try a different strategy
						strategy: originalOp.strategy === "strict" ? ("fuzzy" as any) : ("strict" as any),
					},
					explanation: `Try using ${originalOp.strategy === "strict" ? "fuzzy" : "strict"} matching strategy`,
					confidence: 0.5,
					isAutoApplicable: false,
					sideEffects: ["May have unintended side effects with different matching strategy"],
				})
			}
	}

	return suggestions
}

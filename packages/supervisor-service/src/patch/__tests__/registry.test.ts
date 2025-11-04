/**
 * Tests for registry management functionality
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest"
import { promises as fs } from "fs"
import { join } from "path"
import {
	readRegistry,
	writeRegistry,
	mergeObservation,
	addSuggestedOp,
	limitRegistrySize,
	createObservation,
	inferSuggestedOps,
	Registry,
	RegistryObservation,
} from "../registry.js"
import { ErrorReport, ErrorClassification, ErrorSeverity } from "../../contracts/error-report.js"
import { PatchOp, PatchStrategy } from "../types.js"
import { SuggestedOp } from "../../contracts/remediation-plan.js"

describe("Registry Management", () => {
	const testRegistryPath = join(process.cwd(), "test-registry.json")

	beforeEach(async () => {
		// Clean up any existing test registry
		try {
			await fs.unlink(testRegistryPath)
		} catch {
			// File doesn't exist, which is fine
		}
	})

	afterEach(async () => {
		// Clean up test registry
		try {
			await fs.unlink(testRegistryPath)
		} catch {
			// File doesn't exist, which is fine
		}
	})

	describe("readRegistry", () => {
		it("should create default registry when file does not exist", async () => {
			const registry = await readRegistry(testRegistryPath)

			expect(registry.version).toBe("1.0.0")
			expect(registry.observations).toEqual([])
			expect(registry.suggestedOps).toEqual([])
			expect(registry.updatedAt).toBeInstanceOf(Date)
		})

		it("should read existing registry file", async () => {
			const testRegistry: Registry = {
				version: "1.0.0",
				updatedAt: new Date(),
				observations: [
					{
						file: "test.ts",
						classification: ErrorClassification.ANCHOR_MISMATCH,
						message: "Test error",
						firstSeen: new Date(),
						lastSeen: new Date(),
						count: 1,
					},
				],
				suggestedOps: [],
			}

			await fs.writeFile(testRegistryPath, JSON.stringify(testRegistry, null, 2))
			const registry = await readRegistry(testRegistryPath)

			expect(registry.observations).toHaveLength(1)
			expect(registry.observations[0]!.file).toBe("test.ts")
			expect(registry.observations[0]!.firstSeen).toBeInstanceOf(Date)
			expect(registry.observations[0]!.lastSeen).toBeInstanceOf(Date)
		})

		it("should handle corrupted registry file", async () => {
			await fs.writeFile(testRegistryPath, "invalid json")
			const registry = await readRegistry(testRegistryPath)

			expect(registry.observations).toEqual([])
			expect(registry.suggestedOps).toEqual([])
		})
	})

	describe("writeRegistry", () => {
		it("should write registry to file", async () => {
			const registry: Registry = {
				version: "1.0.0",
				updatedAt: new Date(),
				observations: [
					{
						file: "test.ts",
						classification: ErrorClassification.ANCHOR_MISMATCH,
						message: "Test error",
						firstSeen: new Date(),
						lastSeen: new Date(),
						count: 1,
					},
				],
				suggestedOps: [],
			}

			await writeRegistry(registry, testRegistryPath)

			const fileContent = await fs.readFile(testRegistryPath, "utf-8")
			const parsedRegistry = JSON.parse(fileContent) as Registry

			expect(parsedRegistry.observations).toHaveLength(1)
			expect(parsedRegistry.observations[0]!.file).toBe("test.ts")
		})

		it("should create directories if they do not exist", async () => {
			const nestedPath = join(process.cwd(), "nested", "dir", "registry.json")
			const registry: Registry = {
				version: "1.0.0",
				updatedAt: new Date(),
				observations: [],
				suggestedOps: [],
			}

			await writeRegistry(registry, nestedPath)

			const fileContent = await fs.readFile(nestedPath, "utf-8")
			expect(fileContent).toContain("1.0.0")

			// Clean up
			await fs.rm(join(process.cwd(), "nested", "dir"), { recursive: true })
		})
	})

	describe("mergeObservation", () => {
		it("should add new observation", () => {
			const registry: Registry = {
				version: "1.0.0",
				updatedAt: new Date(),
				observations: [],
				suggestedOps: [],
			}

			const observation: RegistryObservation = {
				file: "test.ts",
				classification: ErrorClassification.ANCHOR_MISMATCH,
				message: "Test error",
				firstSeen: new Date(),
				lastSeen: new Date(),
				count: 1,
			}

			const updatedRegistry = mergeObservation(registry, observation)

			expect(updatedRegistry.observations).toHaveLength(1)
			expect(updatedRegistry.observations[0]!.file).toBe("test.ts")
		})

		it("should merge existing observation", () => {
			const firstSeen = new Date("2023-01-01")
			const lastSeen = new Date("2023-01-02")

			const registry: Registry = {
				version: "1.0.0",
				updatedAt: new Date(),
				observations: [
					{
						file: "test.ts",
						classification: ErrorClassification.ANCHOR_MISMATCH,
						message: "Test error",
						firstSeen,
						lastSeen,
						count: 1,
					},
				],
				suggestedOps: [],
			}

			const observation: RegistryObservation = {
				file: "test.ts",
				classification: ErrorClassification.ANCHOR_MISMATCH,
				message: "Test error",
				firstSeen: new Date(),
				lastSeen: new Date("2023-01-03"),
				count: 1,
			}

			const updatedRegistry = mergeObservation(registry, observation)

			expect(updatedRegistry.observations).toHaveLength(1)
			expect(updatedRegistry.observations[0]!.count).toBe(2)
			expect(updatedRegistry.observations[0]!.firstSeen).toEqual(firstSeen)
			expect(updatedRegistry.observations[0]!.lastSeen).toEqual(new Date("2023-01-03"))
		})
	})

	describe("addSuggestedOp", () => {
		it("should add new suggested operation", () => {
			const registry: Registry = {
				version: "1.0.0",
				updatedAt: new Date(),
				observations: [],
				suggestedOps: [],
			}

			const suggestedOp: SuggestedOp = {
				id: "test-op",
				op: {
					id: "patch-op",
					type: "search_replace",
					strategy: PatchStrategy.STRICT,
					filePath: "test.ts",
					search: "old",
					replace: "new",
				},
				explanation: "Test explanation",
				confidence: 0.8,
				isAutoApplicable: true,
			}

			const updatedRegistry = addSuggestedOp(registry, suggestedOp)

			expect(updatedRegistry.suggestedOps).toHaveLength(1)
			expect(updatedRegistry.suggestedOps[0]!.id).toBe("test-op")
		})

		it("should not add duplicate suggested operation", () => {
			const suggestedOp: SuggestedOp = {
				id: "test-op",
				op: {
					id: "patch-op",
					type: "search_replace",
					strategy: PatchStrategy.STRICT,
					filePath: "test.ts",
					search: "old",
					replace: "new",
				},
				explanation: "Test explanation",
				confidence: 0.8,
				isAutoApplicable: true,
			}

			const registry: Registry = {
				version: "1.0.0",
				updatedAt: new Date(),
				observations: [],
				suggestedOps: [suggestedOp],
			}

			const duplicateOp: SuggestedOp = {
				...suggestedOp,
				id: "different-id",
			}

			const updatedRegistry = addSuggestedOp(registry, duplicateOp)

			expect(updatedRegistry.suggestedOps).toHaveLength(1)
		})
	})

	describe("limitRegistrySize", () => {
		it("should keep registry size under limit", () => {
			const observations: RegistryObservation[] = []
			const baseDate = new Date("2023-01-01")

			// Create 10 observations with different timestamps
			for (let i = 0; i < 10; i++) {
				observations.push({
					file: `test${i}.ts`,
					classification: ErrorClassification.ANCHOR_MISMATCH,
					message: `Test error ${i}`,
					firstSeen: new Date(baseDate.getTime() + i * 1000),
					lastSeen: new Date(baseDate.getTime() + i * 1000),
					count: 1,
				})
			}

			const registry: Registry = {
				version: "1.0.0",
				updatedAt: new Date(),
				observations,
				suggestedOps: [],
			}

			const limitedRegistry = limitRegistrySize(registry, 5)

			expect(limitedRegistry.observations).toHaveLength(5)
			// Should keep the most recent 5 observations
			expect(limitedRegistry.observations[0]!.file).toBe("test5.ts")
			expect(limitedRegistry.observations[4]!.file).toBe("test9.ts")
		})

		it("should not modify registry if under limit", () => {
			const registry: Registry = {
				version: "1.0.0",
				updatedAt: new Date(),
				observations: [
					{
						file: "test.ts",
						classification: ErrorClassification.ANCHOR_MISMATCH,
						message: "Test error",
						firstSeen: new Date(),
						lastSeen: new Date(),
						count: 1,
					},
				],
				suggestedOps: [],
			}

			const limitedRegistry = limitRegistrySize(registry, 5)

			expect(limitedRegistry.observations).toHaveLength(1)
		})
	})

	describe("createObservation", () => {
		it("should create observation from error report", () => {
			const errorReport: ErrorReport = {
				file: "test.ts",
				classification: ErrorClassification.ANCHOR_MISMATCH,
				severity: ErrorSeverity.ERROR,
				message: "Anchor not found",
			}

			const observation = createObservation(errorReport)

			expect(observation.file).toBe("test.ts")
			expect(observation.classification).toBe(ErrorClassification.ANCHOR_MISMATCH)
			expect(observation.message).toBe("Anchor not found")
			expect(observation.count).toBe(1)
			expect(observation.firstSeen).toBeInstanceOf(Date)
			expect(observation.lastSeen).toBeInstanceOf(Date)
		})

		it("should include anchors and candidates", () => {
			const errorReport: ErrorReport = {
				file: "test.ts",
				classification: ErrorClassification.ANCHOR_MISMATCH,
				severity: ErrorSeverity.ERROR,
				message: "Anchor not found",
			}

			const triedAnchors = {
				triedAfter: ["anchor1", "anchor2"],
				triedBefore: ["anchor3"],
			}

			const candidates = {
				after: "newAnchor",
				before: "beforeAnchor",
			}

			const observation = createObservation(errorReport, triedAnchors, candidates)

			expect(observation.anchors).toEqual(triedAnchors)
			expect(observation.candidates).toEqual(candidates)
		})
	})

	describe("inferSuggestedOps", () => {
		it("should infer suggestions for anchor mismatch", () => {
			const errorReport: ErrorReport = {
				file: "test.ts",
				classification: ErrorClassification.ANCHOR_MISMATCH,
				severity: ErrorSeverity.ERROR,
				message: "Anchor not found",
				details: {
					anchor: "long anchor text\nwith multiple lines",
				},
			}

			const originalOp: PatchOp = {
				id: "test-op",
				type: "anchor",
				strategy: PatchStrategy.STRICT,
				filePath: "test.ts",
				anchor: "long anchor text\nwith multiple lines",
				insert: "new code",
				position: "after",
			}

			const suggestions = inferSuggestedOps(errorReport, originalOp)

			expect(suggestions).toHaveLength(1)
			expect(suggestions[0]!.op.type).toBe("anchor")
			expect(suggestions[0]!.explanation).toContain("shorter anchor")
		})

		it("should infer suggestions for search not found", () => {
			const errorReport: ErrorReport = {
				file: "test.ts",
				classification: ErrorClassification.SEARCH_NOT_FOUND,
				severity: ErrorSeverity.ERROR,
				message: "Search pattern not found",
				details: {
					searchPattern: "long search pattern\nwith multiple lines",
				},
			}

			const originalOp: PatchOp = {
				id: "test-op",
				type: "search_replace",
				strategy: PatchStrategy.STRICT,
				filePath: "test.ts",
				search: "long search pattern\nwith multiple lines",
				replace: "replacement",
			}

			const suggestions = inferSuggestedOps(errorReport, originalOp)

			expect(suggestions).toHaveLength(1)
			expect(suggestions[0]!.op.type).toBe("search_replace")
			expect(suggestions[0]!.explanation).toContain("shorter search pattern")
		})

		it("should infer suggestions for multiple matches", () => {
			const errorReport: ErrorReport = {
				file: "test.ts",
				classification: ErrorClassification.MULTIPLE_MATCHES,
				severity: ErrorSeverity.ERROR,
				message: "Multiple matches found",
				details: {
					line: 10,
				},
			}

			const originalOp: PatchOp = {
				id: "test-op",
				type: "search_replace",
				strategy: PatchStrategy.STRICT,
				filePath: "test.ts",
				search: "pattern",
				replace: "replacement",
			}

			const suggestions = inferSuggestedOps(errorReport, originalOp)

			expect(suggestions).toHaveLength(1)
			expect(suggestions[0]!.op.type).toBe("search_replace")
			expect(suggestions[0]!.explanation).toContain("line number hint")
		})

		it("should infer suggestions for other errors", () => {
			const errorReport: ErrorReport = {
				file: "test.ts",
				classification: ErrorClassification.UNKNOWN,
				severity: ErrorSeverity.ERROR,
				message: "Unknown error",
			}

			const originalOp: PatchOp = {
				id: "test-op",
				type: "search_replace",
				strategy: PatchStrategy.STRICT,
				filePath: "test.ts",
				search: "pattern",
				replace: "replacement",
			}

			const suggestions = inferSuggestedOps(errorReport, originalOp)

			expect(suggestions).toHaveLength(1)
			expect(suggestions[0]!.explanation).toContain("matching strategy")
		})
	})
})

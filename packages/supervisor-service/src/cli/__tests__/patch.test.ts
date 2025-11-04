/**
 * Tests for the CLI patch interface
 */

import { describe, test, expect, beforeEach, afterEach } from "vitest"
import {
	parseArguments,
	readPatchPlanFromStdin,
	loadTaskEnvelope,
	applySecurityConstraints,
	ensureKilocodeDirectories,
	writeErrorReport,
	updateRegistry,
	DEFAULT_CONSERVATIVE_ENVELOPE,
} from "../patch.js"
import { promises as fs } from "fs"
import { join } from "path"
import type { PatchPlan } from "../../patch/types.js"
import type { TaskScope } from "../../contracts/task-envelope.js"

describe("CLI Patch Interface", () => {
	const testPlan: PatchPlan = {
		id: "test-plan",
		ops: [
			{
				id: "op1",
				strategy: "strict" as any,
				filePath: "test.txt",
				type: "search_replace",
				search: "old",
				replace: "new",
			},
		],
	}

	describe("parseArguments", () => {
		test("should parse empty arguments", () => {
			const options = parseArguments([])
			expect(options.dryRun).toBe(false)
			expect(options.envelopePath).toBeUndefined()
		})

		test("should parse dry-run flag", () => {
			const options = parseArguments(["--dry-run"])
			expect(options.dryRun).toBe(true)
			expect(options.envelopePath).toBeUndefined()
		})

		test("should parse envelope path", () => {
			const options = parseArguments(["--envelope", "custom.json"])
			expect(options.dryRun).toBe(false)
			expect(options.envelopePath).toBe("custom.json")
		})

		test("should parse both flags", () => {
			const options = parseArguments(["--dry-run", "--envelope", "custom.json"])
			expect(options.dryRun).toBe(true)
			expect(options.envelopePath).toBe("custom.json")
		})
	})

	describe("applySecurityConstraints", () => {
		test("should add security constraints to scope", () => {
			const originalScope: TaskScope = {
				allowPaths: ["src"],
				denyPaths: ["test"],
				allowOps: ["search_replace"],
				maxRetries: 3,
				timeBudgetSec: 300,
			}

			const securedScope = applySecurityConstraints(originalScope)

			expect(securedScope.allowPaths).toEqual(["src"])
			expect(securedScope.denyPaths).toContain("test")
			expect(securedScope.denyPaths).toContain("**/*0.0.0.0*")
			expect(securedScope.denyPaths).toContain("**/*port*")
			expect(securedScope.denyPaths).toContain("**/*listen*")
			expect(securedScope.allowOps).toEqual(["search_replace"])
			expect(securedScope.maxRetries).toBe(3)
			expect(securedScope.timeBudgetSec).toBe(300)
		})

		test("should not modify original scope", () => {
			const originalScope: TaskScope = {
				allowPaths: [],
				denyPaths: [],
				allowOps: [],
				maxRetries: 3,
				timeBudgetSec: 300,
			}

			const securedScope = applySecurityConstraints(originalScope)

			expect(originalScope.denyPaths).toEqual([])
			expect(securedScope.denyPaths.length).toBeGreaterThan(0)
		})
	})

	describe("DEFAULT_CONSERVATIVE_ENVELOPE", () => {
		test("should have proper structure", () => {
			expect(DEFAULT_CONSERVATIVE_ENVELOPE.id).toBe("default-conservative")
			expect(DEFAULT_CONSERVATIVE_ENVELOPE.scope).toBeDefined()
			expect(DEFAULT_CONSERVATIVE_ENVELOPE.metadata).toBeDefined()
			expect(DEFAULT_CONSERVATIVE_ENVELOPE.options).toBeDefined()
		})

		test("should have security-focused deny paths", () => {
			const denyPaths = DEFAULT_CONSERVATIVE_ENVELOPE.scope.denyPaths

			expect(denyPaths).toContain("/etc")
			expect(denyPaths).toContain("/usr")
			expect(denyPaths).toContain("**/.ssh")
			expect(denyPaths).toContain("**/.aws")
			expect(denyPaths).toContain("**/node_modules/.bin")
		})

		test("should have conservative options", () => {
			const options = DEFAULT_CONSERVATIVE_ENVELOPE.options

			expect(options?.continueOnError).toBe(true)
			expect(options?.createBackups).toBe(true)
			expect(options?.validateBeforeApply).toBe(true)
			expect(options?.runLinting).toBe(false)
			expect(options?.runTypeChecking).toBe(false)
		})
	})

	describe("ensureKilocodeDirectories", () => {
		test("should create required directories", async () => {
			await ensureKilocodeDirectories()

			// Check if directories exist
			const kilocodeExists = await fs
				.access(".kilocode")
				.then(() => true)
				.catch(() => false)
			const plansExists = await fs
				.access(".kilocode/patch-plans")
				.then(() => true)
				.catch(() => false)
			const reportsExists = await fs
				.access(".kilocode/patch-reports")
				.then(() => true)
				.catch(() => false)

			expect(kilocodeExists).toBe(true)
			expect(plansExists).toBe(true)
			expect(reportsExists).toBe(true)
		})
	})

	describe("writeErrorReport", () => {
		test("should write error report to file", async () => {
			const errorReport = [
				{
					file: "test.txt",
					classification: "unknown" as any,
					severity: "error" as any,
					message: "Test error",
					operationId: "op1",
					timestamp: new Date(),
				},
			]

			const reportPath = await writeErrorReport(errorReport)

			expect(reportPath).toMatch(
				/^\.kilocode\/patch-reports\/error-report-\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}-\d{3}Z\.json$/,
			)

			// Verify file content
			const content = await fs.readFile(reportPath, "utf-8")
			const parsed = JSON.parse(content)

			// Convert timestamp back to Date for comparison
			parsed[0].timestamp = new Date(parsed[0].timestamp)
			expect(parsed).toEqual(errorReport)

			// Clean up
			await fs.unlink(reportPath)
		})
	})
})

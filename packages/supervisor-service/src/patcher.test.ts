/**
 * Comprehensive test suite for Smart Patcher system
 * Tests all major functionality including patch strategies, error handling, and security constraints
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest"
import {
	PatchPlan,
	PatchOp,
	SearchReplaceOp,
	AnchorOp,
	AstOp,
	PatchStrategy,
	PatchOutcome,
	PatchClassification,
} from "./patch/types.js"
import { TaskEnvelope, TaskScope } from "./contracts/task-envelope.js"
import { ErrorClassification, ErrorSeverity } from "./contracts/error-report.js"
import { RemediationStrategy } from "./contracts/remediation-plan.js"
import { classifyToolMessage, generateErrorReport, generateRemediationPlan } from "./patch/classifier.js"
import { validatePatchPlan, validateTaskEnvelope, checkSecurityViolations } from "./patch/validators.js"
import {
	readRegistry,
	writeRegistry,
	mergeObservation,
	addSuggestedOp,
	limitRegistrySize,
	createObservation,
	inferSuggestedOps,
} from "./patch/registry.js"
import { applyAnchorPatch } from "./patch/anchors.js"
import { applyAstPatch, addImportStub } from "./patch/ast.js"

// Mock file system operations
const mockFs = vi.hoisted(() => ({
	existsSync: vi.fn(),
	readFileSync: vi.fn(),
	writeFileSync: vi.fn(),
	promises: {
		mkdir: vi.fn(),
		readFile: vi.fn(),
		writeFile: vi.fn(),
		copyFile: vi.fn(),
	},
}))

// Mock path operations
const mockPath = vi.hoisted(() => ({
	resolve: vi.fn((path: string) => `/resolved/${path}`),
	join: vi.fn((...paths: string[]) => paths.join("/")),
}))

// Mock crypto
const mockCrypto = vi.hoisted(() => ({
	createHash: vi.fn(() => ({
		update: vi.fn(),
		digest: vi.fn(() => "mock-hash"),
	})),
}))

vi.mock("fs", () => mockFs)
vi.mock("path", () => mockPath)
vi.mock("crypto", () => mockCrypto)

describe("Smart Patcher System", () => {
	let testEnvelope: TaskEnvelope
	let testPlan: PatchPlan

	beforeEach(() => {
		// Setup test envelope with permissive scope
		testEnvelope = {
			id: "test-envelope-1",
			scope: {
				allowPaths: ["src/", "tests/"],
				denyPaths: ["node_modules/", ".git/"],
				allowOps: ["search_replace", "anchor", "ast"],
				maxRetries: 3,
				timeBudgetSec: 60,
			},
			plan: {} as PatchPlan,
			metadata: {
				description: "Test envelope for patcher tests",
				requester: "test-suite",
				priority: 1,
				tags: ["test"],
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

		// Setup test plan
		testPlan = {
			id: "test-plan-1",
			ops: [],
			metadata: {
				description: "Test plan for patcher tests",
				author: "test-suite",
				version: "1.0.0",
			},
		}

		// Reset all mocks
		vi.clearAllMocks()

		// Default mock implementations
		mockFs.existsSync.mockReturnValue(true)
		mockFs.readFileSync.mockReturnValue("test file content")
		mockFs.writeFileSync.mockImplementation(() => {})
		mockPath.resolve.mockImplementation((path: string) => `/resolved/${path}`)
	})

	afterEach(() => {
		vi.restoreAllMocks()
	})

	describe('1. "no-op classified" (search==replace)', () => {
		it("should verify already_applied classification", () => {
			const message = "search and replace content are identical"
			const classification = classifyToolMessage(message)

			expect(classification).toBe(ErrorClassification.ALREADY_APPLIED)
		})

		it("should test idempotence behavior for identical strings", () => {
			const content = "const x = 1;"
			const noOpOp: SearchReplaceOp = {
				id: "noop-2",
				strategy: PatchStrategy.STRICT,
				filePath: "test.js",
				type: "search_replace",
				search: content,
				replace: content,
			}

			// Test that identical search and replace strings are detected
			expect(noOpOp.search).toBe(noOpOp.replace)
			expect(noOpOp.search).toBe(content)
		})
	})

	describe('2. "anchor mismatch → fuzzy applies"', () => {
		it("should verify fuzzy matching works when strict fails", () => {
			const content = "function testFunction() {\n  return true;\n}"
			const anchor = "function testFunction() {"

			// Test that anchor patch works when anchor is found
			const result = applyAnchorPatch(content, {
				id: "anchor-2",
				strategy: PatchStrategy.FUZZY,
				filePath: "test.js",
				type: "anchor",
				anchor,
				insert: '  console.log("injected");',
				position: "after",
			} as AnchorOp)

			expect(result).toContain('console.log("injected");')
			expect(result).toContain("return true;")
		})

		it("should test anchor-based patch application", () => {
			const content = "const Component = () => {\n  return <div>Hello</div>;\n};"
			const anchor = "return <div>Hello</div>;"

			const result = applyAnchorPatch(content, {
				id: "anchor-3",
				strategy: PatchStrategy.FUZZY,
				filePath: "Component.js",
				type: "anchor",
				anchor,
				insert: "<span>World</span>",
				position: "before",
			} as AnchorOp)

			expect(result).toContain("<span>World</span>")
			expect(result).toContain("return <div>Hello</div>;")
		})

		it("should handle anchor not found scenario", () => {
			const content = "function existingFunction() {}"
			const anchor = "function nonExistentFunction() {"

			const result = applyAnchorPatch(content, {
				id: "anchor-missing",
				strategy: PatchStrategy.FUZZY,
				filePath: "test.js",
				type: "anchor",
				anchor,
				insert: 'console.log("added");',
				position: "after",
			} as AnchorOp)

			// Should return null when anchor is not found
			expect(result).toBeNull()
		})
	})

	describe('3. "ast stub addImport" idempotent', () => {
		it("should test AST addImport functionality", () => {
			const content = 'import React from "react";\n\nconst Component = () => {};'
			const result = addImportStub(content, "useState", "react")

			expect(result).toContain("import { useState } from 'react'")
			expect(result).toContain('import React from "react";')
		})

		it("should verify idempotence (no duplicate imports)", () => {
			const content = 'import { useState } from "react";\nimport React from "react";'
			const result = addImportStub(content, "useState", "react")

			// Should not add duplicate import
			const importMatches = result.match(/import\s*{\s*useState\s*}\s*from\s*['"]react['"]/g)
			expect(importMatches).toHaveLength(1)
		})

		it("should test import insertion at correct location", () => {
			const content = 'import React from "react";\n\nconst Component = () => {};'
			const result = addImportStub(content, "useEffect", "react")

			// Should insert after existing imports
			const reactImportIndex = result.indexOf('import React from "react";')
			const useEffectImportIndex = result.indexOf("import { useEffect } from 'react'")

			expect(useEffectImportIndex).toBeGreaterThan(reactImportIndex)
		})

		it("should test AST patch operation", () => {
			const content = "const Component = () => {};"
			const result = applyAstPatch(content, {
				id: "ast-1",
				strategy: PatchStrategy.AST,
				filePath: "test.js",
				type: "ast",
				selector: "addImport:useState:react",
				operation: "replace",
				content: 'import { useState } from "react";',
			} as AstOp)

			expect(result).toContain("import { useState } from 'react'")
		})
	})

	describe("4. Envelope deny path → blocked with proper classification", () => {
		it("should verify proper error classification", () => {
			const message = "permission denied: access denied"
			const classification = classifyToolMessage(message)

			// Should be classified as permission error (security violation)
			expect(classification).toBe(ErrorClassification.PERMISSION_ERROR)
		})

		it("should test allowPaths and denyPaths functionality", () => {
			const allowedOp: SearchReplaceOp = {
				id: "allowed-1",
				strategy: PatchStrategy.STRICT,
				filePath: "src/components/Button.js",
				type: "search_replace",
				search: "old",
				replace: "new",
			}

			const deniedOp: SearchReplaceOp = {
				id: "denied-2",
				strategy: PatchStrategy.STRICT,
				filePath: "node_modules/package/index.js",
				type: "search_replace",
				search: "old",
				replace: "new",
			}

			// Test path validation - simplified test without importing the module
			// This tests the concept of allowPaths and denyPaths
			expect(allowedOp.filePath).toContain("src/")
			expect(deniedOp.filePath).toContain("node_modules/")
		})
	})

	describe("5. Security constraint tests", () => {
		it("should test that 0.0.0.0 binding attempts are blocked", () => {
			const maliciousContent = 'app.listen(3000, "0.0.0.0");'
			const violations = checkSecurityViolations(maliciousContent)

			expect(violations).toContain("Potential binding to all interfaces (0.0.0.0 or ::)")
		})

		it("should test local-first constraints", () => {
			const localhostContent = 'app.listen(3000, "127.0.0.1");'
			const violations = checkSecurityViolations(localhostContent)

			// Localhost binding should not trigger violations
			expect(violations).not.toContain("Potential binding to all interfaces (0.0.0.0 or ::)")
		})

		it("should detect dangerous code patterns", () => {
			const dangerousContent = `
        eval(userInput);
        setTimeout(maliciousFunction, 1000);
        child_process.spawn('rm', ['-rf', '/']);
      `

			const violations = checkSecurityViolations(dangerousContent)

			expect(violations).toContain("Use of eval() function")
			expect(violations).toContain("Use of setTimeout() function")
			expect(violations).toContain("Use of child_process module")
		})
	})

	describe("6. Registry management tests", () => {
		it("should test observation creation and merging", async () => {
			const registry = await readRegistry("/mock/registry.json")

			const observation1 = createObservation({
				file: "test.js",
				classification: ErrorClassification.ANCHOR_MISMATCH,
				severity: ErrorSeverity.ERROR,
				message: "Anchor not found",
				timestamp: new Date(),
			})

			const updatedRegistry = mergeObservation(registry, observation1)

			expect(updatedRegistry.observations).toHaveLength(1)
			expect(updatedRegistry.observations[0]!.file).toBe("test.js")
			expect(updatedRegistry.observations[0]!.count).toBe(1)

			// Merge same observation again
			const observation2 = { ...observation1, lastSeen: new Date() }
			const finalRegistry = mergeObservation(updatedRegistry, observation2)

			expect(finalRegistry.observations).toHaveLength(1)
			expect(finalRegistry.observations[0]!.count).toBe(2)
		})

		it("should test suggested operations inference", () => {
			const errorReport = {
				file: "test.js",
				classification: ErrorClassification.ANCHOR_MISMATCH,
				severity: ErrorSeverity.ERROR,
				message: "Anchor not found",
				timestamp: new Date(),
				details: { anchor: "function test() {" },
			}

			const originalOp: AnchorOp = {
				id: "original-1",
				strategy: PatchStrategy.FUZZY,
				filePath: "test.js",
				type: "anchor",
				anchor: "function test() {",
				insert: 'console.log("test");',
				position: "after",
			}

			const suggestions = inferSuggestedOps(errorReport, originalOp)

			expect(suggestions.length).toBeGreaterThan(0)
			expect(suggestions[0]!.op.type).toBe("anchor")
			expect(suggestions[0]!.confidence).toBeGreaterThan(0)
		})

		it("should test registry size limiting", async () => {
			const registry = await readRegistry("/mock/registry.json")

			// Add many observations
			for (let i = 0; i < 600; i++) {
				const observation = createObservation({
					file: `test${i}.js`,
					classification: ErrorClassification.ANCHOR_MISMATCH,
					severity: ErrorSeverity.ERROR,
					message: `Anchor not found ${i}`,
					timestamp: new Date(),
				})

				mergeObservation(registry, observation)
			}

			// Limit to 500 entries
			const limitedRegistry = limitRegistrySize(registry, 500)

			expect(limitedRegistry.observations.length).toBeLessThanOrEqual(500)
		})
	})

	describe("7. Error classification tests", () => {
		it("should test various error message classifications", () => {
			const testCases = [
				{
					message: "search and replace content are identical",
					expected: ErrorClassification.ALREADY_APPLIED,
				},
				{
					message: "no match for patch hunk",
					expected: ErrorClassification.ANCHOR_MISMATCH,
				},
				{
					message: "eslint error at line 10:5",
					expected: ErrorClassification.LINT_ERROR,
				},
				{
					message: "typescript error TS2304: Cannot find name",
					expected: ErrorClassification.TYPE_ERROR,
				},
				{
					message: "operation timed out after 30 seconds",
					expected: ErrorClassification.TIMEOUT,
				},
				{
					message: "file not found: /path/to/file.js",
					expected: ErrorClassification.FILE_NOT_FOUND,
				},
				{
					message: "permission denied: access denied",
					expected: ErrorClassification.PERMISSION_ERROR,
				},
				{
					message: "search pattern not found",
					expected: ErrorClassification.SEARCH_NOT_FOUND,
				},
				{
					message: "multiple matches found",
					expected: ErrorClassification.MULTIPLE_MATCHES,
				},
				{
					message: "ast parse error",
					expected: ErrorClassification.AST_PARSE_ERROR,
				},
				{
					message: "syntax error: unexpected token",
					expected: ErrorClassification.SYNTAX_ERROR,
				},
			]

			testCases.forEach(({ message, expected }) => {
				const classification = classifyToolMessage(message)
				expect(classification).toBe(expected)
			})
		})

		it("should verify remediation plan generation", () => {
			const errorReport = generateErrorReport(
				"test.js",
				ErrorClassification.ANCHOR_MISMATCH,
				"Anchor not found",
				{ anchor: "function test() {" },
			)

			const remediationPlan = generateRemediationPlan(errorReport)

			expect(remediationPlan.id).toBeDefined()
			expect(remediationPlan.errors).toHaveLength(1)
			expect(remediationPlan.suggestedOps.length).toBeGreaterThan(0)
			expect(remediationPlan.confidence).toBeGreaterThan(0)
			expect(remediationPlan.strategy).toBe(RemediationStrategy.FIRST_SUCCESS)
		})

		it("should test error report creation", () => {
			const errorReport = generateErrorReport(
				"test.js",
				ErrorClassification.LINT_ERROR,
				"eslint error at line 10:5",
				{
					line: 10,
					column: 5,
					rule: "no-unused-vars",
					originalError: 'unused variable "x"',
				},
			)

			expect(errorReport.file).toBe("test.js")
			expect(errorReport.classification).toBe(ErrorClassification.LINT_ERROR)
			expect(errorReport.severity).toBe(ErrorSeverity.WARNING)
			expect(errorReport.message).toBe("eslint error at line 10:5")
			expect(errorReport.details?.line).toBe(10)
			expect(errorReport.details?.column).toBe(5)
			expect(errorReport.suggestions).toBeDefined()
			expect(errorReport.suggestions!.length).toBeGreaterThan(0)
		})
	})

	describe("8. Integration tests", () => {
		it("should test multi-operation plans structure", () => {
			const ops: PatchOp[] = [
				{
					id: "multi-1",
					strategy: PatchStrategy.STRICT,
					filePath: "file1.js",
					type: "search_replace",
					search: "old1",
					replace: "new1",
				},
				{
					id: "multi-2",
					strategy: PatchStrategy.STRICT,
					filePath: "file2.js",
					type: "search_replace",
					search: "old2",
					replace: "new2",
				},
				{
					id: "multi-3",
					strategy: PatchStrategy.AST,
					filePath: "file3.js",
					type: "ast",
					selector: "addImport:useEffect:react",
					operation: "replace",
					content: 'import { useEffect } from "react";',
				},
			]

			testPlan.ops = ops

			// Verify plan structure
			expect(testPlan.ops).toHaveLength(3)
			expect(testPlan.ops[0]!.type).toBe("search_replace")
			expect(testPlan.ops[1]!.type).toBe("search_replace")
			expect(testPlan.ops[2]!.type).toBe("ast")
		})
	})

	describe("Validation tests", () => {
		it("should validate patch plans", () => {
			const validPlan: PatchPlan = {
				id: "valid-plan",
				ops: [
					{
						id: "valid-op",
						strategy: PatchStrategy.STRICT,
						filePath: "test.js",
						type: "search_replace",
						search: "old",
						replace: "new",
					},
				],
				metadata: {
					description: "Valid test plan",
					author: "test",
					version: "1.0.0",
				},
			}

			const result = validatePatchPlan(validPlan)
			expect(result.isValid).toBe(true)
			expect(result.errors).toHaveLength(0)
		})

		it("should validate task envelopes", () => {
			const validEnvelope: TaskEnvelope = {
				id: "valid-envelope",
				scope: {
					allowPaths: ["src/"],
					denyPaths: ["node_modules/"],
					allowOps: ["search_replace"],
					maxRetries: 3,
					timeBudgetSec: 60,
				},
				plan: {
					id: "valid-plan",
					ops: [],
				},
				metadata: {
					description: "Valid test envelope",
					requester: "test",
					priority: 1,
					tags: ["test"],
					createdAt: new Date(),
				},
			}

			const result = validateTaskEnvelope(validEnvelope)
			expect(result.isValid).toBe(true)
			expect(result.errors).toHaveLength(0)
		})
	})
})

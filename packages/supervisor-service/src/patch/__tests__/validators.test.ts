/**
 * Tests for the validators module
 */

import { describe, test, expect } from "vitest"
import {
	validatePatchPlan,
	validateTaskEnvelope,
	validateOperation,
	validateFilePath,
	validateOperationType,
	checkSecurityViolations,
	ValidationResult,
} from "../validators.js"
import { PatchPlan, PatchOp, SearchReplaceOp, AnchorOp, AstOp, PatchStrategy } from "../types.js"
import { TaskEnvelope, TaskScope } from "../../contracts/task-envelope.js"

describe("validatePatchPlan", () => {
	test("should validate a correct patch plan", () => {
		const plan: PatchPlan = {
			id: "test-plan",
			ops: [
				{
					id: "op1",
					strategy: PatchStrategy.STRICT,
					type: "search_replace",
					filePath: "src/test.js",
					search: "old code",
					replace: "new code",
				},
			],
		}

		const result = validatePatchPlan(plan)
		expect(result.isValid).toBe(true)
		expect(result.errors).toHaveLength(0)
	})

	test("should reject a plan without id", () => {
		const plan = {
			ops: [],
		} as any

		const result = validatePatchPlan(plan)
		expect(result.isValid).toBe(false)
		expect(result.errors).toContain("Patch plan must have a valid id string")
	})

	test("should reject a plan without ops array", () => {
		const plan = {
			id: "test-plan",
			ops: null,
		} as any

		const result = validatePatchPlan(plan)
		expect(result.isValid).toBe(false)
		expect(result.errors).toContain("Patch plan must have an ops array")
	})

	test("should reject a plan with invalid operations", () => {
		const plan: PatchPlan = {
			id: "test-plan",
			ops: [
				{
					id: "op1",
					strategy: PatchStrategy.STRICT,
					type: "search_replace",
					filePath: "src/test.js",
					search: "old code",
					// Missing replace field
				},
			] as any,
		}

		const result = validatePatchPlan(plan)
		expect(result.isValid).toBe(false)
		expect(result.errors.some((e) => e.includes("Operation at index 0"))).toBe(true)
	})
})

describe("validateTaskEnvelope", () => {
	test("should validate a correct task envelope", () => {
		const envelope: TaskEnvelope = {
			id: "test-envelope",
			scope: {
				allowPaths: ["src/**"],
				denyPaths: ["src/secret/**"],
				allowOps: ["search_replace", "anchor"],
				maxRetries: 3,
				timeBudgetSec: 60,
			},
			plan: {
				id: "test-plan",
				ops: [
					{
						id: "op1",
						strategy: PatchStrategy.STRICT,
						type: "search_replace",
						filePath: "src/test.js",
						search: "old",
						replace: "new",
					},
				],
			},
		}

		const result = validateTaskEnvelope(envelope)
		expect(result.isValid).toBe(true)
		expect(result.errors).toHaveLength(0)
	})

	test("should reject an envelope without id", () => {
		const envelope = {
			scope: {},
			plan: {},
		} as any

		const result = validateTaskEnvelope(envelope)
		expect(result.isValid).toBe(false)
		expect(result.errors).toContain("Task envelope must have a valid id string")
	})

	test("should reject an envelope with invalid scope", () => {
		const envelope: TaskEnvelope = {
			id: "test-envelope",
			scope: {
				allowPaths: [],
				denyPaths: [],
				allowOps: [],
				maxRetries: -1, // Invalid negative value
				timeBudgetSec: 60,
			},
			plan: {
				id: "test-plan",
				ops: [],
			},
		}

		const result = validateTaskEnvelope(envelope)
		expect(result.isValid).toBe(false)
		expect(result.errors.some((e) => e.includes("Scope maxRetries must be a non-negative integer"))).toBe(true)
	})
})

describe("validateOperation", () => {
	test("should validate a correct search_replace operation", () => {
		const op: SearchReplaceOp = {
			id: "op1",
			strategy: PatchStrategy.STRICT,
			type: "search_replace",
			filePath: "src/test.js",
			search: "old code",
			replace: "new code",
		}

		const result = validateOperation(op)
		expect(result.isValid).toBe(true)
		expect(result.errors).toHaveLength(0)
	})

	test("should validate a correct anchor operation", () => {
		const op: AnchorOp = {
			id: "op1",
			strategy: PatchStrategy.STRICT,
			type: "anchor",
			filePath: "src/test.js",
			anchor: "function test()",
			insert: 'console.log("test");',
			position: "after",
		}

		const result = validateOperation(op)
		expect(result.isValid).toBe(true)
		expect(result.errors).toHaveLength(0)
	})

	test("should validate a correct ast operation", () => {
		const op: AstOp = {
			id: "op1",
			strategy: PatchStrategy.AST,
			type: "ast",
			filePath: "src/test.js",
			selector: "function.declaration",
			operation: "replace",
			content: "function newFunction() {}",
		}

		const result = validateOperation(op)
		expect(result.isValid).toBe(true)
		expect(result.errors).toHaveLength(0)
	})

	test("should reject an operation with dangerous file path", () => {
		const op: SearchReplaceOp = {
			id: "op1",
			strategy: PatchStrategy.STRICT,
			type: "search_replace",
			filePath: "../../../etc/passwd", // Dangerous path
			search: "old code",
			replace: "new code",
		}

		const result = validateOperation(op)
		expect(result.isValid).toBe(false)
		expect(
			result.errors.some((e) => e.includes("File path must be relative and not contain dangerous patterns")),
		).toBe(true)
	})
})

describe("validateFilePath", () => {
	test("should allow paths matching allow patterns", () => {
		const allowPaths = ["src/**", "docs/*.md"]
		const denyPaths = ["src/secret/**"]

		expect(validateFilePath("src/app.js", allowPaths, denyPaths)).toBe(true)
		expect(validateFilePath("docs/readme.md", allowPaths, denyPaths)).toBe(true)
	})

	test("should deny paths matching deny patterns", () => {
		const allowPaths = ["src/**"]
		const denyPaths = ["src/secret/**", "src/config/*.json"]

		expect(validateFilePath("src/secret/key.txt", allowPaths, denyPaths)).toBe(false)
		expect(validateFilePath("src/config/database.json", allowPaths, denyPaths)).toBe(false)
	})

	test("should allow all paths if no allow patterns specified", () => {
		const allowPaths: string[] = []
		const denyPaths = ["dangerous/**"]

		expect(validateFilePath("any/path/file.js", allowPaths, denyPaths)).toBe(true)
		expect(validateFilePath("dangerous/file.js", allowPaths, denyPaths)).toBe(false)
	})
})

describe("validateOperationType", () => {
	test("should allow valid operation types", () => {
		const allowOps = ["search_replace", "anchor", "ast"]

		expect(validateOperationType("search_replace", allowOps)).toBe(true)
		expect(validateOperationType("anchor", allowOps)).toBe(true)
		expect(validateOperationType("ast", allowOps)).toBe(true)
	})

	test("should reject invalid operation types", () => {
		const allowOps = ["search_replace", "anchor"]

		expect(validateOperationType("ast", allowOps)).toBe(false)
		expect(validateOperationType("invalid_op", allowOps)).toBe(false)
	})
})

describe("checkSecurityViolations", () => {
	test("should detect 0.0.0.0 binding attempts", () => {
		const content = 'server.listen(3000, "0.0.0.0")'
		const violations = checkSecurityViolations(content)

		expect(violations).toContain("Potential binding to all interfaces (0.0.0.0 or ::)")
	})

	test("should detect dangerous function usage", () => {
		const content = "eval(userInput)"
		const violations = checkSecurityViolations(content)

		expect(violations).toContain("Use of eval() function")
	})

	test("should detect dangerous command usage", () => {
		const content = 'exec("rm -rf /")'
		const violations = checkSecurityViolations(content)

		expect(violations).toContain("Use of exec() function")
		expect(violations).toContain("Use of rm -rf command")
	})

	test("should return empty array for safe content", () => {
		const content = 'console.log("Hello, world!");'
		const violations = checkSecurityViolations(content)

		expect(violations).toHaveLength(0)
	})
})

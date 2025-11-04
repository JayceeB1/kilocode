/**
 * Tests for the error classification system
 */

import { describe, test, expect } from "vitest"
import {
	classifyToolMessage,
	generateErrorReport,
	generateRemediationPlan,
	classifyPatchResult,
	extractErrorDetails,
} from "../classifier.js"
import { ErrorClassification } from "../../contracts/error-report.js"
import { PatchResult, PatchOutcome } from "../types.js"

describe("classifyToolMessage", () => {
	test("should classify already applied errors", () => {
		expect(classifyToolMessage("Search and replace content are identical")).toBe(
			ErrorClassification.ALREADY_APPLIED,
		)
		expect(classifyToolMessage("Content is the same")).toBe(ErrorClassification.ALREADY_APPLIED)
		expect(classifyToolMessage("No changes needed")).toBe(ErrorClassification.ALREADY_APPLIED)
	})

	test("should classify anchor mismatch errors", () => {
		expect(classifyToolMessage("No match for patch hunk")).toBe(ErrorClassification.ANCHOR_MISMATCH)
		expect(classifyToolMessage("Anchor not found")).toBe(ErrorClassification.ANCHOR_MISMATCH)
		expect(classifyToolMessage("Could not find anchor")).toBe(ErrorClassification.ANCHOR_MISMATCH)
	})

	test("should classify ESLint errors", () => {
		expect(classifyToolMessage("ESLint error: Unexpected console statement")).toBe(ErrorClassification.LINT_ERROR)
		expect(classifyToolMessage("Linting error: Missing semicolon")).toBe(ErrorClassification.LINT_ERROR)
		expect(classifyToolMessage("1:1 warning Unused variable")).toBe(ErrorClassification.LINT_ERROR)
	})

	test("should classify TypeScript errors", () => {
		expect(classifyToolMessage("TypeScript error: Cannot find name")).toBe(ErrorClassification.TYPE_ERROR)
		expect(classifyToolMessage("Property does not exist on type")).toBe(ErrorClassification.TYPE_ERROR)
		expect(classifyToolMessage("Type is not assignable")).toBe(ErrorClassification.TYPE_ERROR)
	})

	test("should classify timeout errors", () => {
		expect(classifyToolMessage("Operation timed out")).toBe(ErrorClassification.TIMEOUT)
		expect(classifyToolMessage("IPC timeout")).toBe(ErrorClassification.TIMEOUT)
		expect(classifyToolMessage("RPC timeout")).toBe(ErrorClassification.TIMEOUT)
	})

	test("should classify file not found errors", () => {
		expect(classifyToolMessage("File not found")).toBe(ErrorClassification.FILE_NOT_FOUND)
		expect(classifyToolMessage("ENOENT: no such file")).toBe(ErrorClassification.FILE_NOT_FOUND)
		expect(classifyToolMessage("Cannot find file")).toBe(ErrorClassification.FILE_NOT_FOUND)
	})

	test("should classify permission errors", () => {
		expect(classifyToolMessage("Permission denied")).toBe(ErrorClassification.PERMISSION_ERROR)
		expect(classifyToolMessage("EACCES: permission denied")).toBe(ErrorClassification.PERMISSION_ERROR)
		expect(classifyToolMessage("Access denied")).toBe(ErrorClassification.PERMISSION_ERROR)
	})

	test("should classify security errors", () => {
		expect(classifyToolMessage("Security error: unsafe operation")).toBe(ErrorClassification.PERMISSION_ERROR)
		expect(classifyToolMessage("Blocked by security policy")).toBe(ErrorClassification.PERMISSION_ERROR)
	})

	test("should classify search not found errors", () => {
		expect(classifyToolMessage("Search pattern not found")).toBe(ErrorClassification.SEARCH_NOT_FOUND)
		expect(classifyToolMessage("No match found")).toBe(ErrorClassification.SEARCH_NOT_FOUND)
	})

	test("should classify multiple matches errors", () => {
		expect(classifyToolMessage("Multiple matches found")).toBe(ErrorClassification.MULTIPLE_MATCHES)
		expect(classifyToolMessage("Ambiguous match")).toBe(ErrorClassification.MULTIPLE_MATCHES)
	})

	test("should classify syntax errors", () => {
		expect(classifyToolMessage("Syntax error: Unexpected token")).toBe(ErrorClassification.SYNTAX_ERROR)
		expect(classifyToolMessage("Parse error")).toBe(ErrorClassification.SYNTAX_ERROR)
	})

	test("should classify AST parse errors", () => {
		expect(classifyToolMessage("AST parse error")).toBe(ErrorClassification.AST_PARSE_ERROR)
		expect(classifyToolMessage("Could not parse AST")).toBe(ErrorClassification.AST_PARSE_ERROR)
	})

	test("should default to unknown for unrecognized errors", () => {
		expect(classifyToolMessage("Some unknown error")).toBe(ErrorClassification.UNKNOWN)
		expect(classifyToolMessage("")).toBe(ErrorClassification.UNKNOWN)
	})
})

describe("generateErrorReport", () => {
	test("should generate a basic error report", () => {
		const report = generateErrorReport("test.ts", ErrorClassification.LINT_ERROR, "ESLint error: Missing semicolon")

		expect(report.file).toBe("test.ts")
		expect(report.classification).toBe(ErrorClassification.LINT_ERROR)
		expect(report.message).toBe("ESLint error: Missing semicolon")
		expect(report.timestamp).toBeInstanceOf(Date)
		expect(report.suggestions).toBeDefined()
		expect(report.suggestions!.length).toBeGreaterThan(0)
	})

	test("should include string details as context", () => {
		const report = generateErrorReport(
			"test.ts",
			ErrorClassification.ANCHOR_MISMATCH,
			"Anchor not found",
			"Additional context",
		)

		expect(report.details!.context).toBe("Additional context")
	})

	test("should include object details", () => {
		const details = { line: 10, column: 5 }
		const report = generateErrorReport("test.ts", ErrorClassification.TYPE_ERROR, "Type error", details)

		expect(report.details!.line).toBe(10)
		expect(report.details!.column).toBe(5)
	})

	test("should include specific details based on classification", () => {
		const details = { anchor: "test anchor" }
		const report = generateErrorReport("test.ts", ErrorClassification.ANCHOR_MISMATCH, "Anchor not found", details)

		expect(report.details!.anchor).toBe("test anchor")
	})
})

describe("generateRemediationPlan", () => {
	test("should generate a remediation plan for already applied errors", () => {
		const errorReport = generateErrorReport("test.ts", ErrorClassification.ALREADY_APPLIED, "No changes needed")

		const plan = generateRemediationPlan(errorReport)

		expect(plan.errors).toHaveLength(1)
		expect(plan.suggestedOps).toHaveLength(1)
		expect(plan.confidence).toBe(1.0)
		expect(plan.requiresConfirmation).toBe(false)
		expect(plan.suggestedOps[0]!.explanation).toContain("No action needed")
	})

	test("should generate a remediation plan for anchor mismatch errors", () => {
		const errorReport = generateErrorReport("test.ts", ErrorClassification.ANCHOR_MISMATCH, "Anchor not found", {
			anchor: "test anchor",
		})

		const plan = generateRemediationPlan(errorReport)

		expect(plan.errors).toHaveLength(1)
		expect(plan.suggestedOps.length).toBeGreaterThan(0)
		expect(plan.confidence).toBeGreaterThan(0)
		expect(plan.description).toContain("anchor mismatch")
	})

	test("should generate a remediation plan for lint errors", () => {
		const errorReport = generateErrorReport(
			"test.ts",
			ErrorClassification.LINT_ERROR,
			"ESLint error: Missing semicolon",
		)

		const plan = generateRemediationPlan(errorReport)

		expect(plan.errors).toHaveLength(1)
		expect(plan.suggestedOps).toHaveLength(1)
		expect(plan.suggestedOps[0]!.prerequisites).toContain("Review lint error details")
	})

	test("should generate a remediation plan for type errors", () => {
		const errorReport = generateErrorReport(
			"test.ts",
			ErrorClassification.TYPE_ERROR,
			"TypeScript error: Cannot find name",
		)

		const plan = generateRemediationPlan(errorReport)

		expect(plan.errors).toHaveLength(1)
		expect(plan.suggestedOps).toHaveLength(1)
		expect(plan.suggestedOps[0]!.prerequisites).toContain("Review type error details")
	})

	test("should generate a remediation plan for file not found errors", () => {
		const errorReport = generateErrorReport("test.ts", ErrorClassification.FILE_NOT_FOUND, "File not found")

		const plan = generateRemediationPlan(errorReport)

		expect(plan.errors).toHaveLength(1)
		expect(plan.suggestedOps).toHaveLength(1)
		expect(plan.suggestedOps[0]!.prerequisites).toContain("Verify file path")
	})

	test("should generate a remediation plan for permission errors", () => {
		const errorReport = generateErrorReport("test.ts", ErrorClassification.PERMISSION_ERROR, "Permission denied")

		const plan = generateRemediationPlan(errorReport)

		expect(plan.errors).toHaveLength(1)
		expect(plan.suggestedOps).toHaveLength(1)
		expect(plan.suggestedOps[0]!.prerequisites).toContain("Check file permissions")
	})

	test("should generate a remediation plan for search not found errors", () => {
		const errorReport = generateErrorReport(
			"test.ts",
			ErrorClassification.SEARCH_NOT_FOUND,
			"Search pattern not found",
		)

		const plan = generateRemediationPlan(errorReport)

		expect(plan.errors).toHaveLength(1)
		expect(plan.suggestedOps.length).toBeGreaterThan(0)
		expect(plan.description).toContain("search pattern")
	})

	test("should generate a remediation plan for unknown errors", () => {
		const errorReport = generateErrorReport("test.ts", ErrorClassification.UNKNOWN, "Unknown error")

		const plan = generateRemediationPlan(errorReport)

		expect(plan.errors).toHaveLength(1)
		expect(plan.suggestedOps).toHaveLength(1)
		expect(plan.confidence).toBe(0.3)
		expect(plan.requiresConfirmation).toBe(true)
	})
})

describe("classifyPatchResult", () => {
	test("should classify successful patch results", () => {
		const result: PatchResult = {
			opId: "test-op",
			outcome: PatchOutcome.SUCCESS,
			classification: "bugfix" as any,
		}

		const classification = classifyPatchResult(result)

		expect(classification.classification).toBe(ErrorClassification.ALREADY_APPLIED)
		expect(classification.errorReport).toBeUndefined()
		expect(classification.remediationPlan).toBeUndefined()
	})

	test("should classify failed patch results", () => {
		const result: PatchResult = {
			opId: "test-op",
			outcome: PatchOutcome.FAILURE,
			classification: "bugfix" as any,
			error: "Anchor not found",
		}

		const classification = classifyPatchResult(result)

		expect(classification.classification).toBe(ErrorClassification.ANCHOR_MISMATCH)
		expect(classification.errorReport).toBeDefined()
		expect(classification.remediationPlan).toBeDefined()
	})

	test("should handle unknown patch results", () => {
		const result: PatchResult = {
			opId: "test-op",
			outcome: PatchOutcome.SKIPPED,
			classification: "bugfix" as any,
		}

		const classification = classifyPatchResult(result)

		expect(classification.classification).toBe(ErrorClassification.UNKNOWN)
		expect(classification.errorReport).toBeUndefined()
		expect(classification.remediationPlan).toBeUndefined()
	})
})

describe("extractErrorDetails", () => {
	test("should extract basic error details", () => {
		const error = new Error("Test error")
		const details = extractErrorDetails(error)

		expect(details.name).toBe("Error")
		expect(details.message).toBe("Test error")
		expect(details.stackTrace).toBeDefined()
	})

	test("should extract TypeScript error details", () => {
		const error = new Error("error TS2304: Cannot find name 'test'")
		const details = extractErrorDetails(error)

		expect(details.tsCode).toBe("2304")
		expect(details.tsMessage).toBe("Cannot find name 'test'")
	})

	test("should extract TypeScript error with line and column", () => {
		const error = new Error("test.ts(10,5): error TS2304: Cannot find name 'test'")
		const details = extractErrorDetails(error)

		expect(details.tsCode).toBe("2304")
		expect(details.tsMessage).toBe("Cannot find name 'test'")
		expect(details.line).toBe(10)
		expect(details.column).toBe(5)
	})

	test("should extract ESLint error details", () => {
		const error = new Error("1:5 error Missing semicolon semi")
		const details = extractErrorDetails(error)

		expect(details.line).toBe(1)
		expect(details.column).toBe(5)
		expect(details.severity).toBe("error")
		expect(details.rule).toBe("Missing semicolon semi")
	})

	test("should extract file not found error details", () => {
		const error = new Error("ENOENT: no such file or directory, open 'test.ts'")
		const details = extractErrorDetails(error)

		expect(details.code).toBe("ENOENT")
		expect(details.type).toBe("file_not_found")
		expect(details.filePath).toBe("test.ts")
	})

	test("should extract permission error details", () => {
		const error = new Error("EACCES: permission denied, open 'test.ts'")
		const details = extractErrorDetails(error)

		expect(details.code).toBe("EACCES")
		expect(details.type).toBe("permission_denied")
		expect(details.filePath).toBe("test.ts")
	})
})

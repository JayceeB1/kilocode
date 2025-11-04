import { describe, test, expect } from "vitest"
import {
	findAfterAnchor,
	findBeforeAnchor,
	insertAt,
	ensureImport,
	applyAnchorPatch,
	ReactPatterns,
} from "../anchors.js"
import { PatchStrategy } from "../types.js"

describe("Anchor-based fuzzy matching", () => {
	describe("findAfterAnchor", () => {
		test("finds position after anchor", () => {
			const content = "function test() { return 42; }"
			const anchor = "function test()"
			const result = findAfterAnchor(content, anchor)
			expect(result).toBe(15)
		})

		test("handles whitespace after anchor", () => {
			const content = "function test()   { return 42; }"
			const anchor = "function test()"
			const result = findAfterAnchor(content, anchor)
			expect(result).toBe(15)
		})

		test("returns null when anchor not found", () => {
			const content = "function test() { return 42; }"
			const anchor = "function missing()"
			const result = findAfterAnchor(content, anchor)
			expect(result).toBeNull()
		})
	})

	describe("findBeforeAnchor", () => {
		test("finds position before anchor", () => {
			const content = "function test() { return 42; }"
			const anchor = "{ return 42; }"
			const result = findBeforeAnchor(content, anchor)
			expect(result).toBe(16)
		})

		test("handles whitespace before anchor", () => {
			const content = "function test()   { return 42; }"
			const anchor = "{ return 42; }"
			const result = findBeforeAnchor(content, anchor)
			expect(result).toBe(18)
		})

		test("returns null when anchor not found", () => {
			const content = "function test() { return 42; }"
			const anchor = "{ missing }"
			const result = findBeforeAnchor(content, anchor)
			expect(result).toBeNull()
		})
	})

	describe("insertAt", () => {
		test("inserts string at position", () => {
			const content = "Hello World"
			const result = insertAt(content, 5, " Beautiful")
			expect(result).toBe("Hello Beautiful World")
		})

		test("handles position at beginning", () => {
			const content = "Hello World"
			const result = insertAt(content, 0, "Start ")
			expect(result).toBe("Start Hello World")
		})

		test("handles position at end", () => {
			const content = "Hello World"
			const result = insertAt(content, 11, " End")
			expect(result).toBe("Hello World End")
		})

		test("returns original content for invalid position", () => {
			const content = "Hello World"
			const result = insertAt(content, 20, " Invalid")
			expect(result).toBe("Hello World")
		})
	})

	describe("ensureImport", () => {
		test("adds new import when not present", () => {
			const content = "function test() { return 42; }"
			const result = ensureImport(content, "useState", "react")
			expect(result).toContain("import { useState } from 'react';")
		})

		test("does not add duplicate import", () => {
			const content = "import { useState } from 'react';\nfunction test() { return 42; }"
			const result = ensureImport(content, "useState", "react")
			expect(result).toBe(content)
		})

		test("adds to existing import from same module", () => {
			const content = "import { useEffect } from 'react';\nfunction test() { return 42; }"
			const result = ensureImport(content, "useState", "react")
			expect(result).toContain("import { useEffect , useState} from 'react';")
		})

		test("handles shebang correctly", () => {
			const content = "#!/usr/bin/env node\nfunction test() { return 42; }"
			const result = ensureImport(content, "useState", "react")
			expect(result).toContain("#!/usr/bin/env node\nimport { useState } from 'react';")
		})
	})

	describe("applyAnchorPatch", () => {
		test("applies patch after anchor", () => {
			const content = "function test() { return 42; }"
			const op = {
				id: "test-patch",
				strategy: PatchStrategy.FUZZY,
				filePath: "test.tsx",
				type: "anchor" as const,
				anchor: "function test()",
				insert: " // New comment",
				position: "after" as const,
			}
			const result = applyAnchorPatch(content, op)
			expect(result).toBe("function test() // New comment { return 42; }")
		})

		test("applies patch before anchor", () => {
			const content = "function test() { return 42; }"
			const op = {
				id: "test-patch",
				strategy: PatchStrategy.FUZZY,
				filePath: "test.tsx",
				type: "anchor" as const,
				anchor: "{ return 42; }",
				insert: " // Before return",
				position: "before" as const,
			}
			const result = applyAnchorPatch(content, op)
			expect(result).toBe("function test()  // Before return{ return 42; }")
		})

		test("applies patch with offset", () => {
			const content = "function test() { return 42; }"
			const op = {
				id: "test-patch",
				strategy: PatchStrategy.FUZZY,
				filePath: "test.tsx",
				type: "anchor" as const,
				anchor: "function test()",
				insert: " // With offset",
				position: "after" as const,
				offset: 5,
			}
			const result = applyAnchorPatch(content, op)
			expect(result).toBe("function test() { re // With offsetturn 42; }")
		})

		test("returns null for invalid operation", () => {
			const content = "function test() { return 42; }"
			const op = {
				id: "test-patch",
				strategy: PatchStrategy.FUZZY,
				filePath: "test.tsx",
				type: "anchor" as const,
				anchor: "missing anchor",
				insert: " // New comment",
				position: "after" as const,
			}
			const result = applyAnchorPatch(content, op)
			expect(result).toBeNull()
		})
	})

	describe("ReactPatterns", () => {
		test("has all required patterns", () => {
			expect(ReactPatterns.COMPONENT_IMPORTS_END).toBeInstanceOf(RegExp)
			expect(ReactPatterns.COMPONENT_FUNCTION_OPEN).toBeInstanceOf(RegExp)
			expect(ReactPatterns.COMPONENT_RETURN).toBeInstanceOf(RegExp)
			expect(ReactPatterns.COMPONENT_JSX_CLOSE).toBeInstanceOf(RegExp)
			expect(ReactPatterns.TOOLBAR_DIV).toBeInstanceOf(RegExp)
			expect(ReactPatterns.MENU_ITEM).toBeInstanceOf(RegExp)
			expect(ReactPatterns.ROUTE_REGISTRATION).toBeInstanceOf(RegExp)
		})
	})
})

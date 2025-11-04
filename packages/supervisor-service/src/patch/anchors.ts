/**
 * Anchor-based fuzzy matching utilities for React TSX code patching
 * Provides robust pattern matching for code modifications
 */

import type { PatchOp, AnchorOp } from "./types.js"

/**
 * Finds the position after the given anchor string in content
 * Handles whitespace and newlines robustly using regex patterns
 *
 * @param content - The source content to search in
 * @param anchor - The anchor string to find
 * @returns The position index after the anchor or null if not found
 */
export function findAfterAnchor(content: string, anchor: string): number | null {
	if (!content || !anchor) {
		return null
	}

	// Create a regex pattern that matches the anchor
	const escapedAnchor = anchor.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
	const pattern = new RegExp(`${escapedAnchor}`, "g")

	const match = pattern.exec(content)
	if (!match) {
		return null
	}

	// Return the position right after the anchor
	return match.index + match[0].length
}

/**
 * Finds the position before the given anchor string in content
 * Handles whitespace and newlines robustly using regex patterns
 *
 * @param content - The source content to search in
 * @param anchor - The anchor string to find
 * @returns The position index before the anchor or null if not found
 */
export function findBeforeAnchor(content: string, anchor: string): number | null {
	if (!content || !anchor) {
		return null
	}

	// Create a regex pattern that matches the anchor
	const escapedAnchor = anchor.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
	const pattern = new RegExp(`${escapedAnchor}`, "g")

	const match = pattern.exec(content)
	if (!match) {
		return null
	}

	// Return the position right before the anchor
	return match.index
}

/**
 * Inserts the insert string at the specified position in content
 *
 * @param content - The original content
 * @param position - The position index where to insert
 * @param insert - The string to insert
 * @returns The modified content with the insertion
 */
export function insertAt(content: string, position: number, insert: string): string {
	if (!content || position < 0 || position > content.length) {
		return content
	}

	return content.slice(0, position) + insert + content.slice(position)
}

/**
 * Ensures an import statement exists in the content
 * Checks if the import already exists, and if not, adds it at the appropriate location
 * Handles both named and default imports
 *
 * @param content - The source content
 * @param named - The named import to check/add (e.g., "useState")
 * @param from - The module to import from (e.g., "react")
 * @returns The modified content with the import ensured
 */
export function ensureImport(content: string, named: string, from: string): string {
	if (!content || !named || !from) {
		return content
	}

	// Check if the import already exists
	const importRegex = new RegExp(
		`import\\s+(?:{[^}]*\\b${named}\\b[^}]*}|\\*\\s+as\\s+\\w+|\\w+)\\s+from\\s+['"]${from}['"]`,
		"gm",
	)

	if (importRegex.test(content)) {
		return content
	}

	// Find the position to insert the import
	// Look for existing imports from the same module
	const existingImportRegex = new RegExp(`import\\s+{[^}]*}\\s+from\\s+['"]${from}['"]`, "gm")

	const existingImportMatch = existingImportRegex.exec(content)

	if (existingImportMatch) {
		// Add to existing import
		const importStatement = existingImportMatch[0]
		const insertPos = existingImportMatch.index + importStatement.indexOf("}") + 1
		const updatedImport = importStatement.replace("}", `, ${named}}`)
		return (
			content.slice(0, existingImportMatch.index) +
			updatedImport +
			content.slice(existingImportMatch.index + importStatement.length)
		)
	}

	// Find the last import statement to insert before it
	const allImportsRegex = /import\s+.*?from\s+['"][^'"]*['"];?\s*/gm
	const imports = []
	let match

	while ((match = allImportsRegex.exec(content)) !== null) {
		imports.push({
			statement: match[0],
			index: match.index,
		})
	}

	if (imports.length > 0) {
		// Insert after the last import
		const lastImport = imports[imports.length - 1]
		if (lastImport) {
			const insertPos = lastImport.index + lastImport.statement.length
			const newImport = `\nimport { ${named} } from '${from}';`
			return insertAt(content, insertPos, newImport)
		}
	}

	// If no imports found, insert at the beginning of the file
	// But after any comments or shebang
	const lines = content.split("\n")
	let insertLine = 0

	// Skip shebang
	if (lines[0] && lines[0].startsWith("#!")) {
		insertLine = 1
	}

	// Skip file-level comments
	while (insertLine < lines.length) {
		const line = lines[insertLine]
		if (line === undefined) break

		const trimmedLine = line.trim()
		if (trimmedLine.startsWith("//") || trimmedLine.startsWith("/*") || trimmedLine === "") {
			insertLine++
		} else {
			break
		}
	}

	const insertPos = lines.slice(0, insertLine).join("\n").length
	const newImport = `\nimport { ${named} } from '${from}';`

	return insertAt(content, insertPos, newImport)
}

/**
 * Applies an anchor-based patch operation to content
 *
 * @param content - The original content
 * @param op - The anchor operation to apply
 * @returns The patched content or null if the operation failed
 */
export function applyAnchorPatch(content: string, op: AnchorOp): string | null {
	if (!content || !op.anchor || !op.insert) {
		return null
	}

	let position: number | null

	if (op.position === "after") {
		position = findAfterAnchor(content, op.anchor)
	} else {
		position = findBeforeAnchor(content, op.anchor)
	}

	if (position === null) {
		return null
	}

	// Apply offset if specified
	if (op.offset !== undefined) {
		position += op.offset
	}

	// Ensure position is within bounds
	if (position < 0 || position > content.length) {
		return null
	}

	return insertAt(content, position, op.insert)
}

/**
 * React TSX specific patterns for common anchor operations
 */
export const ReactPatterns = {
	/**
	 * Pattern for finding the end of a component's import section
	 */
	COMPONENT_IMPORTS_END: /import\s+.*?from\s+['"][^'"]*['"];?\s*$/gm,

	/**
	 * Pattern for finding the opening of a component function
	 */
	COMPONENT_FUNCTION_OPEN: /function\s+\w+\s*\([^)]*\)\s*{|const\s+\w+\s*=\s*\([^)]*\)\s*=>\s*{/gm,

	/**
	 * Pattern for finding the return statement in a component
	 */
	COMPONENT_RETURN: /return\s*\(/gm,

	/**
	 * Pattern for finding the closing of a component's JSX
	 */
	COMPONENT_JSX_CLOSE: /\);\s*$/gm,

	/**
	 * Pattern for finding toolbar divs
	 */
	TOOLBAR_DIV: /<div[^>]*className[^>]*toolbar[^>]*>/gm,

	/**
	 * Pattern for finding menu items
	 */
	MENU_ITEM: /<MenuItem[^>]*>/gm,

	/**
	 * Pattern for finding route registrations
	 */
	ROUTE_REGISTRATION: /<Route[^>]*path=/gm,
}

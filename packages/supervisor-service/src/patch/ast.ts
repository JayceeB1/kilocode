/**
 * AST manipulation functionality for Smart Patcher
 * Initial stub implementation using regex patterns
 * TODO: Upgrade to ts-morph for proper AST manipulation
 */

import { AstOp } from "./types.js"

/**
 * Adds an import statement to the content if it doesn't already exist
 * @param content - The file content to modify
 * @param named - The named import to add
 * @param from - The module to import from
 * @returns The modified content with the import added
 */
export function addImportStub(content: string, named: string, from: string): string {
	// TODO: Upgrade to ts-morph for proper AST manipulation
	// This is a stub implementation using regex patterns

	// Check if the import already exists to maintain idempotence
	const importRegex = new RegExp(`import\\s*{[^}]*${named}[^}]*}\\s*from\\s*['"]${from}['"]`, "g")
	if (importRegex.test(content)) {
		return content // Import already exists
	}

	// Try to find existing imports from the same module
	const existingImportRegex = new RegExp(`import\\s*{([^}]*)}\\s*from\\s*['"]${from}['"]`, "g")
	const match = existingImportRegex.exec(content)

	if (match) {
		// Add to existing import
		const existingImports = match[1]
		const updatedImports = existingImports ? `${existingImports.trim()}, ${named}` : named
		return content.replace(match[0], `import { ${updatedImports} } from '${from}'`)
	} else {
		// Create new import statement
		// Find the last import statement to insert after it
		const allImportsRegex = /import[^;]*;/g
		const imports = content.match(allImportsRegex)

		if (imports && imports.length > 0) {
			const lastImport = imports[imports.length - 1]
			if (lastImport) {
				const lastImportIndex = content.lastIndexOf(lastImport)
				const insertPosition = lastImportIndex + lastImport.length

				return (
					content.slice(0, insertPosition) +
					`\nimport { ${named} } from '${from}';` +
					content.slice(insertPosition)
				)
			}
		} else {
			// No imports found, add at the top
			return `import { ${named} } from '${from}';\n${content}`
		}
	}

	// Default fallback
	return content
}

/**
 * Inserts a useEffect hook into the content if it doesn't already exist
 * @param content - The file content to modify
 * @param effectCode - The effect code to insert
 * @returns The modified content with the useEffect added
 */
export function insertUseEffectStub(content: string, effectCode: string): string {
	// TODO: Upgrade to ts-morph for proper AST manipulation
	// This is a stub implementation using regex patterns

	// Check if useEffect with similar content already exists
	const useEffectRegex = /useEffect\(\s*\(\)\s*=>\s*{([^}]*)}\s*,\s*\[[^\]]*\]\s*\)/g
	const matches = content.match(useEffectRegex)

	if (matches) {
		// Check if any existing useEffect contains similar content
		for (const match of matches) {
			if (match.includes(effectCode.substring(0, 20))) {
				return content // Similar useEffect already exists
			}
		}
	}

	// Find a good place to insert the useEffect
	// Look for component function or arrow function
	const componentRegex = /(?:function\s+\w+\(|const\s+\w+\s*=\s*\([^)]*\)\s*=>|const\s+\w+\s*=\s*\([^)]*\)\s*=>\s*{)/g
	const componentMatch = componentRegex.exec(content)

	if (componentMatch) {
		// Find the opening brace of the component
		const componentStart = componentMatch.index
		const braceIndex = content.indexOf("{", componentStart)

		if (braceIndex !== -1) {
			// Find the matching closing brace
			let braceCount = 1
			let insertPosition = braceIndex + 1

			for (let i = braceIndex + 1; i < content.length; i++) {
				if (content[i] === "{") braceCount++
				if (content[i] === "}") braceCount--

				if (braceCount === 0) {
					// Insert before the closing brace
					insertPosition = i
					break
				}
			}

			return (
				content.slice(0, insertPosition) +
				`\n\n  useEffect(() => {\n    ${effectCode}\n  }, []);` +
				content.slice(insertPosition)
			)
		}
	}

	// Fallback: just append to the end
	return content + `\n\nuseEffect(() => {\n  ${effectCode}\n}, []);`
}

/**
 * Inserts JSX element into a toolbar component
 * @param content - The file content to modify
 * @param jsxElement - The JSX element to insert
 * @returns The modified content with the JSX element added to the toolbar
 */
export function insertJSXInToolbarStub(content: string, jsxElement: string): string {
	// TODO: Upgrade to ts-morph for proper AST manipulation
	// This is a stub implementation using regex patterns

	// Look for common toolbar patterns
	const toolbarPatterns = [
		/<Toolbar[^>]*>([^]*?)<\/Toolbar>/g,
		/<div[^>]*className[^>]*toolbar[^>]*>([^]*?)<\/div>/g,
		/<header[^>]*>([^]*?)<\/header>/g,
	]

	for (const pattern of toolbarPatterns) {
		const match = pattern.exec(content)

		if (match) {
			const toolbarContent = match[1]
			const fullMatch = match[0]

			// Check if the JSX element already exists
			if (toolbarContent && toolbarContent.includes(jsxElement)) {
				return content // Element already exists
			}

			// Insert the element before the closing tag
			const closingTagIndex = fullMatch.lastIndexOf("</")
			const beforeClosingTag = fullMatch.substring(0, closingTagIndex)
			const afterClosingTag = fullMatch.substring(closingTagIndex)

			const newToolbarContent = `${beforeClosingTag}\n      ${jsxElement}${afterClosingTag}`

			return content.replace(fullMatch, newToolbarContent)
		}
	}

	// Fallback: try to find any React component and add the element
	const returnStatementRegex = /return\s*\(\s*([^]*?)\s*\)/g
	const returnMatch = returnStatementRegex.exec(content)

	if (returnMatch) {
		const returnContent = returnMatch[1]
		const fullReturnMatch = returnMatch[0]

		// Check if the JSX element already exists
		if (returnContent && returnContent.includes(jsxElement)) {
			return content // Element already exists
		}

		// Find the root element and insert before its closing tag
		const rootElementMatch = returnContent?.match(/^<([^>\s]+)/)

		if (rootElementMatch) {
			const rootTagName = rootElementMatch[1]
			const closingTagRegex = new RegExp(`<\/${rootTagName}>\\s*$`)

			if (returnContent && closingTagRegex.test(returnContent)) {
				const newReturnContent = returnContent.replace(
					closingTagRegex,
					`\n      ${jsxElement}\n    </${rootTagName}>`,
				)

				return content.replace(fullReturnMatch, `return (\n    ${newReturnContent}\n  )`)
			}
		}
	}

	// Last resort: just append to the end
	return content + `\n\n${jsxElement}`
}

/**
 * Applies an AST patch operation based on the operation type
 * @param content - The file content to modify
 * @param op - The AST operation to apply
 * @returns The modified content or null if operation is not supported
 */
export function applyAstPatch(content: string, op: AstOp): string | null {
	try {
		// Check for custom operations in the selector
		// Since AstOp.operation only supports 'replace', 'insert_before', 'insert_after', 'remove'
		// We'll use the selector to specify custom operations
		if (op.selector.startsWith("addImport:")) {
			// Extract parameters from selector
			const importParams = parseImportParams(op.selector, op.content)
			if (importParams) {
				return addImportStub(content, importParams.named, importParams.from)
			}
			return null
		}

		if (op.selector.startsWith("insertUseEffect")) {
			// Extract effect code from content
			if (op.content) {
				return insertUseEffectStub(content, op.content)
			}
			return null
		}

		if (op.selector.startsWith("insertJSXInToolbar")) {
			// Extract JSX element from content
			if (op.content) {
				return insertJSXInToolbarStub(content, op.content)
			}
			return null
		}

		// Handle standard AST operations
		switch (op.operation) {
			case "replace":
			case "insert_before":
			case "insert_after":
			case "remove":
				// TODO: Implement these operations with ts-morph
				console.warn(`AST operation '${op.operation}' not yet implemented`)
				return null

			default:
				console.warn(`Unknown AST operation: ${op.operation}`)
				return null
		}
	} catch (error) {
		console.error("Error applying AST patch:", error)
		return null
	}
}

/**
 * Helper function to parse import parameters from selector and content
 * @param selector - The selector string containing import parameters
 * @param content - The content string containing import parameters
 * @returns Parsed import parameters or null if parsing failed
 */
function parseImportParams(selector: string, content?: string): { named: string; from: string } | null {
	// TODO: Implement proper parameter parsing
	// For now, try to extract from content if available
	if (content) {
		// Try to match pattern: import { named } from 'module'
		const importMatch = content.match(/import\s*{\s*([^}]+)\s*}\s*from\s*['"]([^'"]+)['"]/)
		if (importMatch && importMatch[1] && importMatch[2]) {
			return {
				named: importMatch[1].trim(),
				from: importMatch[2].trim(),
			}
		}
	}

	// Try to extract from selector
	// Expected format: "addImport:named:from" or similar
	const parts = selector.split(":")
	if (parts.length >= 3 && parts[0] === "addImport" && parts[1] && parts[2]) {
		return {
			named: parts[1],
			from: parts[2],
		}
	}

	return null
}

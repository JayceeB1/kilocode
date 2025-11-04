/**
 * Tests for AST manipulation functionality
 */

import { describe, test, expect } from "vitest"
import { addImportStub, insertUseEffectStub, insertJSXInToolbarStub, applyAstPatch } from "../ast.js"
import { AstOp } from "../types.js"

describe("AST manipulation stub functions", () => {
	describe("addImportStub", () => {
		test("should add a new import when no imports exist", () => {
			const content = `
const App = () => {
  return <div>Hello World</div>;
};
`
			const result = addImportStub(content, "useState", "react")
			expect(result).toContain("import { useState } from 'react';")
			expect(result).toContain(content)
		})

		test("should add import after existing imports", () => {
			const content = `
import { useEffect } from 'react';

const App = () => {
  return <div>Hello World</div>;
};
`
			const result = addImportStub(content, "useState", "react")
			expect(result).toContain("import { useEffect, useState } from 'react';")
		})

		test("should add to existing import from same module", () => {
			const content = `
import { useEffect } from 'react';

const App = () => {
  return <div>Hello World</div>;
};
`
			const result = addImportStub(content, "useState", "react")
			expect(result).toContain("import { useEffect, useState } from 'react';")
		})

		test("should be idempotent - not add duplicate imports", () => {
			const content = `
import { useState } from 'react';

const App = () => {
  return <div>Hello World</div>;
};
`
			const result = addImportStub(content, "useState", "react")
			expect(result).toBe(content)
		})
	})

	describe("insertUseEffectStub", () => {
		test("should insert useEffect in a function component", () => {
			const content = `
const App = () => {
  return <div>Hello World</div>;
};
`
			const result = insertUseEffectStub(content, 'console.log("Effect");')
			expect(result).toContain("useEffect(() => {")
			expect(result).toContain('console.log("Effect");')
			expect(result).toContain("}, []);")
		})

		test("should insert useEffect in a function declaration component", () => {
			const content = `
function App() {
  return <div>Hello World</div>;
}
`
			const result = insertUseEffectStub(content, 'console.log("Effect");')
			expect(result).toContain("useEffect(() => {")
			expect(result).toContain('console.log("Effect");')
			expect(result).toContain("}, []);")
		})

		test("should be idempotent - not add duplicate useEffect", () => {
			const content = `
const App = () => {
  useEffect(() => {
    console.log("Effect");
  }, []);
  
  return <div>Hello World</div>;
};
`
			const result = insertUseEffectStub(content, 'console.log("Effect");')
			expect(result).toBe(content)
		})
	})

	describe("insertJSXInToolbarStub", () => {
		test("should insert JSX in a Toolbar component", () => {
			const content = `
const App = () => {
  return (
    <Toolbar>
      <Button>Click me</Button>
    </Toolbar>
  );
};
`
			const result = insertJSXInToolbarStub(content, "<IconButton>Icon</IconButton>")
			expect(result).toContain("<IconButton>Icon</IconButton>")
			expect(result).toContain("<Toolbar>")
			expect(result).toContain("</Toolbar>")
		})

		test("should insert JSX in a div with toolbar class", () => {
			const content = `
const App = () => {
  return (
    <div className="toolbar">
      <Button>Click me</Button>
    </div>
  );
};
`
			const result = insertJSXInToolbarStub(content, "<IconButton>Icon</IconButton>")
			expect(result).toContain("<IconButton>Icon</IconButton>")
			expect(result).toContain('className="toolbar"')
		})

		test("should be idempotent - not add duplicate JSX", () => {
			const content = `
const App = () => {
  return (
    <Toolbar>
      <Button>Click me</Button>
      <IconButton>Icon</IconButton>
    </Toolbar>
  );
};
`
			const result = insertJSXInToolbarStub(content, "<IconButton>Icon</IconButton>")
			expect(result).toBe(content)
		})
	})

	describe("applyAstPatch", () => {
		test("should apply addImport operation", () => {
			const content = `
const App = () => {
  return <div>Hello World</div>;
};
`
			const op: AstOp = {
				id: "test-op",
				strategy: "ast" as any,
				filePath: "test.tsx",
				type: "ast",
				selector: "addImport:useState:react",
				operation: "replace",
				content: "import { useState } from 'react';",
			}

			const result = applyAstPatch(content, op)
			expect(result).toContain("import { useState } from 'react';")
		})

		test("should apply insertUseEffect operation", () => {
			const content = `
const App = () => {
  return <div>Hello World</div>;
};
`
			const op: AstOp = {
				id: "test-op",
				strategy: "ast" as any,
				filePath: "test.tsx",
				type: "ast",
				selector: "insertUseEffect",
				operation: "replace",
				content: 'console.log("Effect");',
			}

			const result = applyAstPatch(content, op)
			expect(result).toContain("useEffect(() => {")
			expect(result).toContain('console.log("Effect");')
		})

		test("should apply insertJSXInToolbar operation", () => {
			const content = `
const App = () => {
  return (
    <Toolbar>
      <Button>Click me</Button>
    </Toolbar>
  );
};
`
			const op: AstOp = {
				id: "test-op",
				strategy: "ast" as any,
				filePath: "test.tsx",
				type: "ast",
				selector: "insertJSXInToolbar",
				operation: "replace",
				content: "<IconButton>Icon</IconButton>",
			}

			const result = applyAstPatch(content, op)
			expect(result).toContain("<IconButton>Icon</IconButton>")
		})

		test("should return null for unsupported operations", () => {
			const content = `
const App = () => {
  return <div>Hello World</div>;
};
`
			const op: AstOp = {
				id: "test-op",
				strategy: "ast" as any,
				filePath: "test.tsx",
				type: "ast",
				selector: "unsupported",
				operation: "replace",
				content: "some content",
			}

			const result = applyAstPatch(content, op)
			expect(result).toBeNull()
		})
	})
})

import * as vscode from "vscode"

export interface SupervisorIssue {
	type: string
	severity: "error" | "warning" | "info"
	message: string
	line?: number
	column?: number
	suggestion?: string
	confidence?: number
	filePath?: string
}

export interface AnalysisResult {
	analysis: {
		issues: SupervisorIssue[]
		suggestions: string[]
		fixedCode?: string
	}
	metadata: {
		model: string
		provider: string
		tokensUsed?: number
		processingTime: number
	}
}

export class ProblemMatcher implements vscode.Disposable {
	private diagnosticCollection: vscode.DiagnosticCollection
	private issues: SupervisorIssue[] = []

	constructor(private outputChannel: vscode.OutputChannel) {
		this.diagnosticCollection = vscode.languages.createDiagnosticCollection("kilocode-supervisor")
	}

	public processAnalysisResult(result: AnalysisResult, filePath?: string): void {
		const issues = result.analysis.issues

		if (issues.length === 0) {
			this.outputChannel.appendLine("No issues found in analysis")
			return
		}

		this.outputChannel.appendLine(`Processing ${issues.length} issues from analysis`)

		// Store issues for later viewing
		this.issues = issues.map((issue) => ({
			...issue,
			filePath: filePath || issue.filePath || "",
		}))

		// Convert to VS Code diagnostics
		const diagnostics = this.convertToDiagnostics(issues, filePath)

		// Apply diagnostics to the appropriate file
		if (filePath) {
			const uri = vscode.Uri.file(filePath)
			this.diagnosticCollection.set(uri, diagnostics)
		} else {
			// If no specific file, try to apply to active editor
			const activeEditor = vscode.window.activeTextEditor
			if (activeEditor) {
				this.diagnosticCollection.set(activeEditor.document.uri, diagnostics)
			}
		}

		// Log summary
		this.logAnalysisSummary(result)
	}

	private convertToDiagnostics(issues: SupervisorIssue[], filePath?: string): vscode.Diagnostic[] {
		return issues.map((issue) => {
			const diagnostic = new vscode.Diagnostic(
				this.getRange(issue),
				issue.message,
				this.getSeverity(issue.severity),
			)

			diagnostic.source = "KiloCode Supervisor"
			diagnostic.code = issue.type

			if (issue.suggestion) {
				diagnostic.relatedInformation = [
					new vscode.DiagnosticRelatedInformation(
						new vscode.Location(vscode.Uri.file(filePath || ""), this.getRange(issue)),
						`Suggestion: ${issue.suggestion}`,
					),
				]
			}

			return diagnostic
		})
	}

	private getRange(issue: SupervisorIssue): vscode.Range {
		if (issue.line !== undefined) {
			const line = Math.max(0, issue.line - 1) // Convert to 0-based
			const column = issue.column ? Math.max(0, issue.column - 1) : 0

			return new vscode.Range(new vscode.Position(line, column), new vscode.Position(line, column + 1))
		}

		// Default to beginning of document
		return new vscode.Range(new vscode.Position(0, 0), new vscode.Position(0, 1))
	}

	private getSeverity(severity: string): vscode.DiagnosticSeverity {
		switch (severity) {
			case "error":
				return vscode.DiagnosticSeverity.Error
			case "warning":
				return vscode.DiagnosticSeverity.Warning
			case "info":
			default:
				return vscode.DiagnosticSeverity.Information
		}
	}

	private logAnalysisSummary(result: AnalysisResult): void {
		const { issues, suggestions } = result.analysis
		const { model, provider, tokensUsed, processingTime } = result.metadata

		this.outputChannel.appendLine("\n=== Analysis Summary ===")
		this.outputChannel.appendLine(`Model: ${provider}/${model}`)
		this.outputChannel.appendLine(`Issues found: ${issues.length}`)
		this.outputChannel.appendLine(`Suggestions: ${suggestions.length}`)

		if (tokensUsed) {
			this.outputChannel.appendLine(`Tokens used: ${tokensUsed}`)
		}

		this.outputChannel.appendLine(`Processing time: ${processingTime}ms`)

		// Log issues by severity
		const errorCount = issues.filter((i) => i.severity === "error").length
		const warningCount = issues.filter((i) => i.severity === "warning").length
		const infoCount = issues.filter((i) => i.severity === "info").length

		this.outputChannel.appendLine(`Breakdown: ${errorCount} errors, ${warningCount} warnings, ${infoCount} info`)
		this.outputChannel.appendLine("========================\n")
	}

	public showProblems(): void {
		if (this.issues.length === 0) {
			vscode.window.showInformationMessage("No supervisor issues to show")
			return
		}

		// Create quick pick items for issues
		const items = this.issues.map((issue, index) => ({
			label: `$(issue-${issue.severity}) ${issue.message}`,
			description: issue.type,
			detail: issue.suggestion || "",
			index,
		}))

		vscode.window
			.showQuickPick(items, {
				placeHolder: `Found ${this.issues.length} issues. Select one to view details.`,
			})
			.then((selected) => {
				if (selected) {
					const issue = this.issues[selected.index]
					if (issue) {
						this.showIssueDetails(issue)
					}
				}
			})
	}

	private showIssueDetails(issue: SupervisorIssue): void {
		const message = [
			`**Type:** ${issue.type}`,
			`**Severity:** ${issue.severity}`,
			`**Message:** ${issue.message}`,
			issue.line ? `**Line:** ${issue.line}${issue.column ? `:${issue.column}` : ""}` : "",
			issue.confidence ? `**Confidence:** ${(issue.confidence * 100).toFixed(1)}%` : "",
			issue.suggestion ? `**Suggestion:** ${issue.suggestion}` : "",
		]
			.filter((line) => line.length > 0)
			.join("\n")

		vscode.window.showInformationMessage("Issue Details", "View in Output Panel").then((selection) => {
			if (selection === "View in Output Panel") {
				this.outputChannel.appendLine("\n=== Issue Details ===")
				this.outputChannel.appendLine(message)
				this.outputChannel.appendLine("====================\n")
				this.outputChannel.show()
			}
		})
	}

	public clearIssues(): void {
		this.diagnosticCollection.clear()
		this.issues = []
		this.outputChannel.appendLine("Cleared all supervisor issues")
	}

	public dispose(): void {
		this.diagnosticCollection.dispose()
	}
}

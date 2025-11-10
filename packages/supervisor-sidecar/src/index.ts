import * as vscode from "vscode"
import { TerminalCapture } from "./terminal.js"
import { ProblemMatcher } from "./problemMatcher.js"
import { SupervisorService } from "./supervisorService.js"

let terminalCapture: TerminalCapture
let problemMatcher: ProblemMatcher
let supervisorService: SupervisorService
let outputChannel: vscode.OutputChannel

export function activate(context: vscode.ExtensionContext) {
	console.log("KiloCode Supervisor Sidecar extension is now active!")

	// Create output channel for logging
	outputChannel = vscode.window.createOutputChannel("KiloCode Supervisor")

	// Initialize services
	supervisorService = new SupervisorService()
	problemMatcher = new ProblemMatcher(outputChannel)
	terminalCapture = new TerminalCapture(supervisorService, outputChannel, problemMatcher)

	// Register commands
	const toggleCaptureCommand = vscode.commands.registerCommand("kilo-code.supervisor.toggleCapture", () =>
		terminalCapture.toggleCapture(),
	)

	const analyzeCurrentFileCommand = vscode.commands.registerCommand("kilo-code.supervisor.analyzeCurrentFile", () =>
		analyzeCurrentFile(),
	)

	const showProblemsCommand = vscode.commands.registerCommand("kilo-code.supervisor.showProblems", () =>
		problemMatcher.showProblems(),
	)

	// Register disposables
	context.subscriptions.push(
		toggleCaptureCommand,
		analyzeCurrentFileCommand,
		showProblemsCommand,
		terminalCapture,
		problemMatcher,
		outputChannel,
	)

	// Check if supervisor service is available
	checkSupervisorService()

	outputChannel.appendLine("KiloCode Supervisor Sidecar activated successfully")
}

async function analyzeCurrentFile(): Promise<void> {
	const editor = vscode.window.activeTextEditor
	if (!editor) {
		vscode.window.showWarningMessage("No active file to analyze")
		return
	}

	const document = editor.document
	const content = document.getText()
	const language = document.languageId
	const filePath = document.fileName

	try {
		outputChannel.appendLine(`Analyzing file: ${filePath}`)

		const result = await supervisorService.analyzeCode({
			code: content,
			language,
			filePath,
			context: "Manual analysis from VS Code",
		})

		// Process and display results
		problemMatcher.processAnalysisResult(result, filePath)

		vscode.window.showInformationMessage(`Analysis complete. Found ${result.analysis.issues.length} issues.`)
	} catch (error) {
		outputChannel.appendLine(`Analysis failed: ${error}`)
		vscode.window.showErrorMessage(`Analysis failed: ${error}`)
	}
}

async function checkSupervisorService(): Promise<void> {
	try {
		const isHealthy = await supervisorService.healthCheck()
		if (isHealthy) {
			outputChannel.appendLine("Supervisor service is healthy and accessible")
		} else {
			outputChannel.appendLine("Supervisor service is not responding")
			vscode.window.showWarningMessage(
				"KiloCode Supervisor service is not running. Start it to enable analysis features.",
			)
		}
	} catch (error) {
		outputChannel.appendLine(`Failed to check supervisor service: ${error}`)
		vscode.window.showWarningMessage("Cannot connect to KiloCode Supervisor service. Check your configuration.")
	}
}

export function deactivate() {
	outputChannel.appendLine("KiloCode Supervisor Sidecar deactivated")
	outputChannel.dispose()
}

import * as vscode from "vscode"
import { SupervisorService } from "./supervisorService.js"
import { ProblemMatcher } from "./problemMatcher.js"

export interface TerminalCaptureConfig {
	enabled: boolean
	captureCommands: string[]
	autoAnalyze: boolean
}

export class TerminalCapture implements vscode.Disposable {
	private disposables: vscode.Disposable[] = []
	private isCapturing = false
	private config: TerminalCaptureConfig
	private terminalData: Map<string, string[]> = new Map()

	constructor(
		private supervisorService: SupervisorService,
		private outputChannel: vscode.OutputChannel,
		private problemMatcher?: ProblemMatcher,
	) {
		this.config = this.loadConfig()
		this.setupEventListeners()
		this.setupConfigWatcher()
	}

	private loadConfig(): TerminalCaptureConfig {
		const config = vscode.workspace.getConfiguration("kilo-code.supervisor")
		return {
			enabled: config.get<boolean>("enabled", false),
			captureCommands: config.get<string[]>("captureCommands", [
				"npm test",
				"pnpm test",
				"yarn test",
				"make test",
			]),
			autoAnalyze: config.get<boolean>("autoAnalyze", true),
		}
	}

	private setupEventListeners(): void {
		// Listen for terminal creation
		const terminalCreationDisposable = vscode.window.onDidOpenTerminal((terminal) => {
			this.setupTerminalCapture(terminal)
		})

		// Listen for terminal execution
		// Note: onDidExecuteTerminalCommand is not available in current VS Code API
		// This will need to be implemented differently when the API is available
		// const terminalExecutionDisposable = vscode.window.onDidExecuteTerminalCommand(async (event) => {
		//   await this.handleTerminalExecution(event);
		// });
		const terminalExecutionDisposable = new vscode.Disposable(() => {})

		this.disposables.push(terminalCreationDisposable, terminalExecutionDisposable)
	}

	private setupConfigWatcher(): void {
		const configWatcher = vscode.workspace.onDidChangeConfiguration((event) => {
			if (event.affectsConfiguration("kilo-code.supervisor")) {
				this.config = this.loadConfig()
				this.outputChannel.appendLine("Supervisor configuration updated")
			}
		})

		this.disposables.push(configWatcher)
	}

	private setupTerminalCapture(terminal: vscode.Terminal): void {
		if (!this.config.enabled) {
			return
		}

		const terminalName = terminal.name
		this.terminalData.set(terminalName, [])

		// Log experimental strategy
		this.outputChannel.appendLine("Using experimental terminal capture strategy")

		// Listen for terminal data
		// Note: onDidWriteData is not available in current VS Code API
		// This will need to be implemented differently when the API is available
		// const dataDisposable = terminal.onDidWriteData((data) => {
		//   this.captureTerminalData(terminalName, data);
		// });

		// Implement capture with onDidWriteTerminalData if strategy is "insiders"
		const dataDisposable = new vscode.Disposable(() => {})
		if (process.env.VSCODE_INSIDERS === "1") {
			// Use insiders API if available
			// Note: This is a placeholder for when the API becomes available
			// const actualDataDisposable = terminal.onDidWriteTerminalData((data) => {
			//   this.captureTerminalData(terminalName, data);
			// });
			this.outputChannel.appendLine("Insiders API detected, but onDidWriteTerminalData not yet available")
		}

		// Add handler for onDidEndTaskProcess to send diagnostic on command failure
		const taskEndDisposable = vscode.tasks.onDidEndTaskProcess((e) => {
			if (e.exitCode !== undefined && e.exitCode !== 0 && this.problemMatcher) {
				// Send a "command_failed" diagnostic to the ProblemMatcher
				const issue = {
					type: "command_failed",
					severity: "error" as const,
					message: `Command failed with exit code ${e.exitCode}`,
					suggestion: "Check the terminal output for more details",
				}

				// Create a minimal analysis result to pass to problemMatcher
				const analysisResult = {
					analysis: {
						issues: [issue],
						suggestions: [],
					},
					metadata: {
						model: "terminal-capture",
						provider: "vscode",
						processingTime: 0,
					},
				}

				this.problemMatcher.processAnalysisResult(analysisResult)
			}
		})

		const closeDisposable = vscode.window.onDidCloseTerminal((closedTerminal) => {
			if (closedTerminal.name === terminalName) {
				this.terminalData.delete(terminalName)
				dataDisposable.dispose()
			}
		})

		this.disposables.push(dataDisposable, taskEndDisposable, closeDisposable)
	}

	private captureTerminalData(terminalName: string, data: string): void {
		if (!this.isCapturing) {
			return
		}

		const terminalOutput = this.terminalData.get(terminalName) || []
		terminalOutput.push(data)
		this.terminalData.set(terminalName, terminalOutput)
	}

	private async handleTerminalExecution(event: { execution: { commandLine: { value: string } } }): Promise<void> {
		if (!this.config.enabled || !this.config.autoAnalyze) {
			return
		}

		const command = event.execution.commandLine.value
		const shouldCapture = this.config.captureCommands.some((captureCommand) => command.includes(captureCommand))

		if (shouldCapture) {
			this.outputChannel.appendLine(`Capturing terminal execution: ${command}`)
			this.isCapturing = true

			// Wait for command to complete, then analyze output
			// Note: This API is not available yet, will need to be implemented differently
			// event.execution.read().then(async (result) => {
			//   if (result.exitCode !== 0) {
			//     await this.analyzeTerminalOutput(command, result.exitCode);
			//   }
			//   this.isCapturing = false;
			// });
			this.isCapturing = false
		}
	}

	private async analyzeTerminalOutput(command: string, exitCode: number): Promise<void> {
		try {
			const terminalOutput = Array.from(this.terminalData.values()).flat().join("\n")

			if (!terminalOutput.trim()) {
				return
			}

			this.outputChannel.appendLine(`Analyzing failed command: ${command} (exit code: ${exitCode})`)

			const analysis = await this.supervisorService.analyzeCode({
				code: terminalOutput,
				language: "shell",
				context: `Failed command execution: ${command} (exit code: ${exitCode})`,
			})

			// Process analysis results
			this.processAnalysisResults(analysis, command)
		} catch (error) {
			this.outputChannel.appendLine(`Failed to analyze terminal output: ${error}`)
		}
	}

	private processAnalysisResults(
		analysis: { analysis?: { issues?: Array<{ message: string; severity: string; suggestion?: string }> } },
		_command: string,
	): void {
		const issues = analysis.analysis?.issues || []

		if (issues.length === 0) {
			this.outputChannel.appendLine("No issues found in terminal output")
			return
		}

		this.outputChannel.appendLine(`Found ${issues.length} issues in terminal output:`)

		issues.forEach((issue, index: number) => {
			this.outputChannel.appendLine(`  ${index + 1}. ${issue.message} (${issue.severity})`)

			if (issue.suggestion) {
				this.outputChannel.appendLine(`     Suggestion: ${issue.suggestion}`)
			}
		})

		// Show notification to user
		vscode.window
			.showWarningMessage(
				`Terminal analysis found ${issues.length} issues. Check output panel for details.`,
				"View Issues",
			)
			.then((selection) => {
				if (selection === "View Issues") {
					this.outputChannel.show()
				}
			})
	}

	public toggleCapture(): void {
		this.config.enabled = !this.config.enabled

		const message = this.config.enabled ? "Terminal capture enabled" : "Terminal capture disabled"

		vscode.window.showInformationMessage(message)
		this.outputChannel.appendLine(message)
	}

	public isEnabled(): boolean {
		return this.config.enabled
	}

	public dispose(): void {
		this.disposables.forEach((d) => d.dispose())
		this.terminalData.clear()
	}
}

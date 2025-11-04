import axios, { AxiosInstance, AxiosResponse } from "axios"
import * as vscode from "vscode"

export interface AnalyzeRequest {
	code: string
	language?: string
	filePath?: string
	context?: string
}

export interface AnalyzeResponse {
	analysis: {
		issues: Array<{
			type: string
			severity: "error" | "warning" | "info"
			message: string
			line?: number
			column?: number
			suggestion?: string
			confidence?: number
		}>
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

export interface HealthResponse {
	status: string
	service: string
	version: string
	config: {
		provider: string
		model: string
		bind: string
		port: number
	}
}

export class SupervisorService {
	private client: AxiosInstance
	private serviceUrl: string

	constructor() {
		this.serviceUrl = this.loadServiceUrl()
		this.client = axios.create({
			baseURL: this.serviceUrl,
			timeout: 30000, // 30 seconds timeout
			headers: {
				"Content-Type": "application/json",
				"User-Agent": "kilocode-supervisor-sidecar/0.0.0",
			},
		})

		this.setupConfigWatcher()
	}

	private loadServiceUrl(): string {
		const config = vscode.workspace.getConfiguration("kilo-code.supervisor")
		return config.get<string>("serviceUrl", "http://127.0.0.1:43110")
	}

	private setupConfigWatcher(): void {
		vscode.workspace.onDidChangeConfiguration((event) => {
			if (event.affectsConfiguration("kilo-code.supervisor.serviceUrl")) {
				const newUrl = this.loadServiceUrl()
				if (newUrl !== this.serviceUrl) {
					this.serviceUrl = newUrl
					this.client.defaults.baseURL = newUrl
				}
			}
		})
	}

	public async analyzeCode(request: AnalyzeRequest): Promise<AnalyzeResponse> {
		try {
			const response: AxiosResponse<AnalyzeResponse> = await this.client.post("/v1/analyze", request)
			return response.data
		} catch (error) {
			if (axios.isAxiosError(error)) {
				const message = error.response?.data?.error || error.message
				throw new Error(`Supervisor service error: ${message}`)
			}
			throw error
		}
	}

	public async healthCheck(): Promise<boolean> {
		try {
			const response: AxiosResponse<HealthResponse> = await this.client.get("/health")
			return response.data.status === "healthy"
		} catch (_error) {
			return false
		}
	}

	public async getServiceInfo(): Promise<HealthResponse | null> {
		try {
			const response: AxiosResponse<HealthResponse> = await this.client.get("/health")
			return response.data
		} catch (_error) {
			return null
		}
	}

	public async testConnection(): Promise<{ success: boolean; message: string }> {
		try {
			const info = await this.getServiceInfo()
			if (info) {
				return {
					success: true,
					message: `Connected to ${info.service} v${info.version} using ${info.config.provider}/${info.config.model}`,
				}
			} else {
				return {
					success: false,
					message: "Failed to get service info",
				}
			}
		} catch (error) {
			if (axios.isAxiosError(error)) {
				if (error.code === "ECONNREFUSED") {
					return {
						success: false,
						message: "Connection refused. Is the supervisor service running?",
					}
				} else if (error.code === "ENOTFOUND") {
					return {
						success: false,
						message: "Service not found. Check the service URL configuration.",
					}
				} else {
					return {
						success: false,
						message: `Network error: ${error.message}`,
					}
				}
			}

			return {
				success: false,
				message: `Unknown error: ${error instanceof Error ? error.message : "Unknown error"}`,
			}
		}
	}
}

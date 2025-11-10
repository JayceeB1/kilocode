import express, { type Express } from "express"
import cors from "cors"
import helmet from "helmet"
import { loadConfig } from "./config.js"
import { analyzeCode, healthCheck } from "./analyze.js"
import { handlePatchRequest, validatePatchMiddleware } from "./routes/patch.js"

export function createServerApp(config = loadConfig()): Express {
	const app = express()

	// Security middleware
	app.use(
		helmet({
			contentSecurityPolicy: false, // Allow for API usage
			crossOriginEmbedderPolicy: false,
		}),
	)

	// Conditional CORS configuration
	const localhostOnly = !config.allowLAN
	const origins = localhostOnly
		? [/^http:\/\/localhost(:\d+)?$/, /^http:\/\/127\.0\.0\.1(:\d+)?$/]
		: [/^http:\/\/localhost(:\d+)?$/, /^http:\/\/127\.0\.0\.1(:\d+)?$/, /^http:\/\/10\.0\.4\.\d{1,3}(:\d+)?$/]

	app.use(cors({ origin: origins, credentials: true }))

	// Body parsing middleware
	app.use(express.json({ limit: "10mb" }))
	app.use(express.urlencoded({ extended: true, limit: "10mb" }))

	// Request logging middleware
	app.use((req, res, next) => {
		const timestamp = new Date().toISOString()
		console.log(`[${timestamp}] ${req.method} ${req.path} - ${req.ip}`)
		next()
	})

	// Routes
	app.get("/health", healthCheck)

	app.post("/v1/analyze", analyzeCode)

	app.post("/v1/patch", validatePatchMiddleware, handlePatchRequest)

	// 404 handler
	app.use("*", (req, res) => {
		res.status(404).json({
			error: "Not Found",
			message: `Route ${req.method} ${req.originalUrl} not found`,
			availableRoutes: ["GET /health", "POST /v1/analyze", "POST /v1/patch"],
		})
	})

	// Global error handler
	app.use((err: Error, req: express.Request, res: express.Response, _next: express.NextFunction) => {
		console.error("Unhandled error:", err)
		res.status(500).json({
			error: "Internal Server Error",
			message: process.env.NODE_ENV === "development" ? err.message : "Something went wrong",
		})
	})

	return app
}

async function startServer(): Promise<void> {
	try {
		// Load configuration
		const config = loadConfig()

		// Create Express app
		const app = createServerApp(config)

		// Start server
		const server = app.listen(config.port, config.bind, () => {
			console.log(`🚀 KiloCode Supervisor Service started on http://${config.bind}:${config.port}`)
			console.log(`📊 Health check: http://${config.bind}:${config.port}/health`)
			console.log(`🔍 Analysis endpoint: http://${config.bind}:${config.port}/v1/analyze`)
			console.log(`🔧 Patch endpoint: http://${config.bind}:${config.port}/v1/patch`)
			console.log(`🧠 Using ${config.provider} with model: ${config.model}`)

			// Correct logging based on LAN configuration
			if (config.allowLAN) {
				console.log(
					`🔓 Security: LAN access enabled on ${config.bind}:${config.port} (CIDR allowed: ${config.allowedLANs?.join(", ") || "none"})`,
				)
			} else {
				console.log("🔒 Security: Localhost-only access")
			}
		})

		// Graceful shutdown
		const gracefulShutdown = (signal: string) => {
			console.log(`\n🛑 Received ${signal}, shutting down gracefully...`)
			server.close(() => {
				console.log("✅ Server closed successfully")
				process.exit(0)
			})
		}

		process.on("SIGTERM", () => gracefulShutdown("SIGTERM"))
		process.on("SIGINT", () => gracefulShutdown("SIGINT"))
	} catch (error) {
		console.error("❌ Failed to start server:", error)
		process.exit(1)
	}
}

// Start server if this file is run directly
if (import.meta.url === `file://${process.argv[1]}`) {
	startServer().catch((error) => {
		console.error("❌ Server startup failed:", error)
		process.exit(1)
	})
}

export { startServer }

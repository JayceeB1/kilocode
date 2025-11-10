import { z } from "zod"
import { readFileSync } from "fs"
import { join } from "path"
import { isIP } from "node:net"

const PORT_MIN = 9600
const PORT_MAX = 9699
const LOOPBACK_HOSTS = new Set(["127.0.0.1", "::1", "localhost"])

const SupervisorConfigSchema = z.object({
	bind: z.string().default("127.0.0.1"),
	port: z.number().int().positive().default(9611),
	provider: z.enum(["ollama", "llama.cpp"]).default("ollama"),
	endpoint: z.string().default("http://127.0.0.1:11434"),
	model: z.string().default("llama3.1:8b-instruct-q4"),
	max_tokens: z.number().int().positive().default(768),
	temperature: z.number().min(0).max(2).default(0.2),
	allowLAN: z.boolean().default(false),
	allowedLANs: z.array(z.string()).default(["10.0.4.0/24"]),
	autoLaunch: z.boolean().default(false),
	redactLog: z.boolean().default(true),
	autoFixWhitelist: z.array(z.string()).default(["path_not_found", "missing_dep", "flaky_test_rerun"]),
	autoFixMinConfidence: z.number().min(0).max(1).default(0.75),
	reflexion: z
		.object({
			enabled: z.boolean().default(true),
			maxItems: z.number().int().positive().default(128),
			ttlDays: z.number().int().positive().default(60),
		})
		.default({ enabled: true, maxItems: 128, ttlDays: 60 }),
})

export type SupervisorConfig = z.infer<typeof SupervisorConfigSchema>

let config: SupervisorConfig | null = null

export function loadConfig(configPath?: string): SupervisorConfig {
	if (config) {
		return config
	}

	try {
		const defaultConfigPath = join(process.cwd(), ".kilocode", "supervisor.config.json")
		const pathToUse = configPath || defaultConfigPath
		const configData = readFileSync(pathToUse, "utf-8")
		const parsedConfig = JSON.parse(configData)

		const parsed = SupervisorConfigSchema.parse(parsedConfig)
		config = enforceNetworkConstraints(parsed)
		return config
	} catch (error) {
		console.warn("Failed to load supervisor config, using defaults:", error)
		config = enforceNetworkConstraints(SupervisorConfigSchema.parse({}))
		return config
	}
}

export function getConfig(): SupervisorConfig {
	if (!config) {
		return loadConfig()
	}
	return config
}

export function resetConfig(): void {
	config = null
}

function enforceNetworkConstraints(parsed: SupervisorConfig): SupervisorConfig {
	const sanitized: SupervisorConfig = {
		...parsed,
		allowedLANs: parsed.allowedLANs.map((entry) => entry.trim()).filter(Boolean),
	}

	validatePort(sanitized.port)
	validateBindAddress(sanitized.bind, sanitized.allowLAN, sanitized.allowedLANs)

	return sanitized
}

function validatePort(port: number): void {
	if (port < PORT_MIN || port > PORT_MAX) {
		throw new Error(`Port ${port} is outside the allowed range ${PORT_MIN}-${PORT_MAX}`)
	}
}

function validateBindAddress(bind: string, allowLAN: boolean, allowedLANs: string[]): void {
	if (!allowLAN && !isLoopback(bind)) {
		throw new Error(`Binding to ${bind} is forbidden unless allowLAN=true`)
	}

	if (allowLAN) {
		if (allowedLANs.length === 0) {
			throw new Error("allowLAN=true requires at least one entry in allowedLANs")
		}

		if (!isLoopback(bind) && !isAddressAllowed(bind, allowedLANs)) {
			throw new Error(`Bind address ${bind} is not covered by allowedLANs`)
		}
	}
}

function isLoopback(host: string): boolean {
	return LOOPBACK_HOSTS.has(host)
}

function isAddressAllowed(bind: string, allowedLANs: string[]): boolean {
	if (isLoopback(bind)) {
		return true
	}

	const bindIp = extractIPv4(bind)
	if (!bindIp) {
		throw new Error(`Unsupported bind address ${bind}. Use IPv4 loopback or entries from allowedLANs.`)
	}

	for (const entry of allowedLANs) {
		const cidr = parseCidr(entry)
		if (cidr && isIpInCidr(bindIp, cidr)) {
			return true
		}
		if (!entry.includes("/") && entry === bindIp) {
			return true
		}
	}

	return false
}

function extractIPv4(host: string): string | null {
	if (isIP(host) === 4) {
		return host
	}
	return null
}

type CidrRange = { base: number; mask: number }

function parseCidr(entry: string): CidrRange | null {
	const [ip, bitsStr] = entry.split("/")
	if (!ip || !bitsStr) {
		return null
	}

	const bits = Number(bitsStr)
	if (!Number.isInteger(bits) || bits < 0 || bits > 32) {
		return null
	}

	const ipInt = ipv4ToInt(ip)
	if (ipInt === null) {
		return null
	}

	const mask = bits === 0 ? 0 : (~0 << (32 - bits)) >>> 0
	return { base: ipInt & mask, mask }
}

function ipv4ToInt(ip: string): number | null {
	if (isIP(ip) !== 4) {
		return null
	}
	return ip.split(".").reduce((acc, octet) => (acc << 8) + Number(octet), 0) >>> 0
}

function isIpInCidr(ip: string, cidr: CidrRange): boolean {
	const ipInt = ipv4ToInt(ip)
	if (ipInt === null) {
		return false
	}
	return (ipInt & cidr.mask) === cidr.base
}

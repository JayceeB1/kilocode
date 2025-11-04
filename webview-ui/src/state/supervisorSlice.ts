import React, { createContext, useContext, useEffect, useState } from "react"
import { invoke } from "../utils/vscode"

export type SupervisorConfig = {
	version: 1
	enabled: boolean
	autoLaunch: boolean
	bind: string // "127.0.0.1" or LAN (10.0.4.x)
	port: number // 9600..9699 (default 9611)
	provider: "ollama" | "llama.cpp"
	endpoint: string // e.g. http://127.0.0.1:11434
	model: string
	max_tokens: number
	temperature: number
	allowLAN: boolean
	allowedLANs: string[]
	redactLog: boolean
}

type Ctx = {
	enabled: boolean
	setEnabled: (v: boolean) => void
}

const SupervisorCtx = createContext<Ctx>({ enabled: false, setEnabled: () => {} })

export const SupervisorProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
	const [enabled, setEnabled] = useState(false)

	// Hydrate depuis la config (IPC)
	useEffect(() => {
		;(async () => {
			try {
				const cfg = await invoke<SupervisorConfig>("supervisor:get")
				if (cfg && typeof cfg.enabled === "boolean") setEnabled(!!cfg.enabled)
			} catch {
				// Ignore errors
			}
		})()
	}, [])

	// Raccourci clavier Ctrl+Alt+L
	useEffect(() => {
		const onKey = (e: KeyboardEvent) => {
			const k = e.key?.toLowerCase()
			if (e.ctrlKey && e.altKey && k === "l") setEnabled((v) => !v)
		}
		window.addEventListener("keydown", onKey)
		return () => window.removeEventListener("keydown", onKey)
	}, [])

	return React.createElement(SupervisorCtx.Provider, { value: { enabled, setEnabled } }, children)
}

export const useSupervisor = () => useContext(SupervisorCtx)

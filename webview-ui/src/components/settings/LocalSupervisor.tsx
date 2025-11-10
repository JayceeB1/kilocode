import React, { useEffect, useState } from "react"
import { Cpu } from "lucide-react"
import { sendWithCompat } from "../../utils/vscode"
import type { SupervisorConfig } from "../../state/supervisorSlice"
import { SectionHeader } from "./SectionHeader"

const DEFAULTS: Partial<SupervisorConfig> = {
	bind: "127.0.0.1",
	port: 9611,
	allowLAN: false,
	allowedLANs: ["10.0.4.0/24"],
}

export default function LocalSupervisorSettings() {
	const [cfg, setCfg] = useState<SupervisorConfig | null>(null)
	const [saving, setSaving] = useState(false)
	const [error, setError] = useState<string | null>(null)
	const set = (k: keyof SupervisorConfig, v: any) => setCfg((prev) => (prev ? ({ ...prev, [k]: v } as any) : prev))

	useEffect(() => {
		;(async () => {
			try {
				const c = (await sendWithCompat("supervisor:get")) as SupervisorConfig
				setCfg({ ...DEFAULTS, ...c } as SupervisorConfig)
			} catch (e: any) {
				setError(e?.message ?? "Unable to load config")
			}
		})()
	}, [])

	async function save() {
		if (!cfg) return
		setSaving(true)
		setError(null)
		try {
			// validation UI simple
			if (cfg.bind === "0.0.0.0") throw new Error("0.0.0.0 est interdit")
			if (cfg.port < 9600 || cfg.port > 9699) throw new Error("Le port doit être entre 9600 et 9699")
			if (cfg.allowLAN && (!cfg.allowedLANs || cfg.allowedLANs.length === 0)) {
				throw new Error("Ajoutez au moins un réseau autorisé lorsque Allow LAN est activé")
			}
			const next = (await sendWithCompat("supervisor:set", cfg)) as SupervisorConfig
			setCfg(next)
		} catch (e: any) {
			setError(e?.message ?? "Save failed")
		} finally {
			setSaving(false)
		}
	}

	async function reset() {
		try {
			const fresh = (await sendWithCompat("supervisor:get")) as SupervisorConfig
			setCfg({ ...DEFAULTS, ...fresh } as SupervisorConfig)
			setError(null)
		} catch (e: any) {
			setError(e?.message ?? "Reset failed")
		}
	}

	if (!cfg) return <div>Loading…</div>

	return (
		<div className="p-4 space-y-3">
			<SectionHeader>
				<div className="flex items-center gap-2">
					<Cpu className="w-4" />
					<div>Local Supervisor</div>
				</div>
			</SectionHeader>
			{error && <div className="text-red-500 text-sm">{error}</div>}
			<div className="grid grid-cols-2 gap-3">
				<label className="flex items-center gap-2">
					<input type="checkbox" checked={cfg.enabled} onChange={(e) => set("enabled", e.target.checked)} />
					Enable
				</label>
				<label className="flex items-center gap-2">
					<input
						type="checkbox"
						checked={cfg.autoLaunch}
						onChange={(e) => set("autoLaunch", e.target.checked)}
					/>
					Auto-launch at app start
				</label>

				<div>
					<div className="text-sm font-medium">Bind</div>
					<select value={cfg.bind} onChange={(e) => set("bind", e.target.value)} className="w-full">
						<option value="127.0.0.1">127.0.0.1 (localhost)</option>
						<option value="10.0.4.70">10.0.4.70 (LAN)</option>
					</select>
				</div>
				<div>
					<div className="text-sm font-medium">Port (9600–9699)</div>
					<input
						type="number"
						min={9600}
						max={9699}
						value={cfg.port}
						onChange={(e) => set("port", Number(e.target.value))}
						className="w-full"
					/>
				</div>

				<div>
					<div className="text-sm font-medium">Provider</div>
					<select
						value={cfg.provider}
						onChange={(e) => set("provider", e.target.value as any)}
						className="w-full">
						<option value="ollama">Ollama</option>
						<option value="llama.cpp">llama.cpp</option>
					</select>
				</div>
				<div>
					<div className="text-sm font-medium">Endpoint</div>
					<input value={cfg.endpoint} onChange={(e) => set("endpoint", e.target.value)} className="w-full" />
				</div>

				<div>
					<div className="text-sm font-medium">Model</div>
					<input value={cfg.model} onChange={(e) => set("model", e.target.value)} className="w-full" />
				</div>
				<div>
					<div className="text-sm font-medium">Max tokens</div>
					<input
						type="number"
						value={cfg.max_tokens}
						onChange={(e) => set("max_tokens", Number(e.target.value))}
						className="w-full"
					/>
				</div>
				<div>
					<div className="text-sm font-medium">Temperature</div>
					<input
						type="number"
						step="0.05"
						min="0"
						max="1"
						value={cfg.temperature}
						onChange={(e) => set("temperature", Number(e.target.value))}
						className="w-full"
					/>
				</div>

				<label className="flex items-center gap-2 col-span-2">
					<input type="checkbox" checked={cfg.allowLAN} onChange={(e) => set("allowLAN", e.target.checked)} />
					Allow LAN (10.0.4.0/24) — <span className="text-amber-500">exposition publique interdite</span>
				</label>
			</div>

			<div className="flex gap-2">
				<button onClick={save} disabled={saving} className="px-3 py-1 rounded bg-blue-600 text-white">
					Save
				</button>
				<button onClick={reset} className="px-3 py-1 rounded">
					Reset
				</button>
			</div>
		</div>
	)
}

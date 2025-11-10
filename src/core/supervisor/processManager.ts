import { spawn, ChildProcessWithoutNullStreams } from "child_process"
import * as path from "node:path"
import * as fs from "node:fs"
import * as vscode from "vscode"

type ProcState = { proc?: ChildProcessWithoutNullStreams; restarting?: boolean }
const state: ProcState = {}

export function startSupervisorService(serviceEntryAbsPath: string, bind: string, port: number) {
	if (state.proc) {
		console.warn("[supervisor-process] Service already running")
		return
	}

	const args = [serviceEntryAbsPath]
	const env = { ...process.env }

	// Hard-guard at spawn time as well:
	if (bind === "0.0.0.0") bind = "127.0.0.1"
	env.SUPERVISOR_BIND = bind
	env.SUPERVISOR_PORT = String(port)

	const nodeBin = process.execPath
	const proc = spawn(nodeBin, args, { env, stdio: ["pipe", "pipe", "pipe"] })
	state.proc = proc

	proc.stdout.on("data", (d) => console.log(`[supervisor-service] ${String(d)}`))
	proc.stderr.on("data", (d) => console.warn(`[supervisor-service] ${String(d)}`))
	proc.on("exit", (code) => {
		console.warn(`[supervisor-service] exited code=${code}`)
		state.proc = undefined
	})

	// Store process reference for cleanup
	if (context) {
		context.subscriptions.push({
			dispose: () => {
				if (state.proc) {
					try {
						state.proc.kill("SIGTERM")
					} catch {}
					state.proc = undefined
				}
			},
		})
	}
}

export function stopSupervisorService() {
	if (!state.proc) {
		console.warn("[supervisor-process] Service not running")
		return
	}
	try {
		state.proc.kill("SIGTERM")
	} catch (e) {
		console.error("[supervisor-process] Error stopping service:", e)
	}
	state.proc = undefined
}

export function isSupervisorServiceRunning(): boolean {
	return !!state.proc
}

import type { WebviewApi } from "vscode-webview"

import { MaybeTypedWebviewMessage as WebviewMessage } from "@roo/WebviewMessage" // kilocode_change - using MaybeTypedWebviewMessage

/**
 * A utility wrapper around the acquireVsCodeApi() function, which enables
 * message passing and state management between the webview and extension
 * contexts.
 *
 * This utility also enables webview code to be run in a web browser-based
 * dev server by using native web browser features that mock the functionality
 * enabled by acquireVsCodeApi.
 */
class VSCodeAPIWrapper {
	private readonly vsCodeApi: WebviewApi<unknown> | undefined

	constructor() {
		// Check if the acquireVsCodeApi function exists in the current development
		// context (i.e. VS Code development window or web browser)
		if (typeof acquireVsCodeApi === "function") {
			this.vsCodeApi = acquireVsCodeApi()
		}
	}

	/**
	 * Post a message (i.e. send arbitrary data) to the owner of the webview.
	 *
	 * @remarks When running webview code inside a web browser, postMessage will instead
	 * log the given message to the console.
	 *
	 * @param message Arbitrary data (must be JSON serializable) to send to the extension context.
	 */
	public postMessage(message: WebviewMessage) {
		if (this.vsCodeApi) {
			this.vsCodeApi.postMessage(message)
		} else {
			console.log(message)
		}
	}

	/**
	 * Get the persistent state stored for this webview.
	 *
	 * @remarks When running webview source code inside a web browser, getState will retrieve state
	 * from local storage (https://developer.mozilla.org/en-US/docs/Web/API/Window/localStorage).
	 *
	 * @return The current state or `undefined` if no state has been set.
	 */
	public getState(): unknown | undefined {
		if (this.vsCodeApi) {
			return this.vsCodeApi.getState()
		} else {
			const state = localStorage.getItem("vscodeState")
			return state ? JSON.parse(state) : undefined
		}
	}

	/**
	 * Set the persistent state stored for this webview.
	 *
	 * @remarks When running webview source code inside a web browser, setState will set the given
	 * state using local storage (https://developer.mozilla.org/en-US/docs/Web/API/Window/localStorage).
	 *
	 * @param newState New persisted state. This must be a JSON serializable object. Can be retrieved
	 * using {@link getState}.
	 *
	 * @return The new state.
	 */
	public setState<T extends unknown | undefined>(newState: T): T {
		if (this.vsCodeApi) {
			return this.vsCodeApi.setState(newState)
		} else {
			localStorage.setItem("vscodeState", JSON.stringify(newState))
			return newState
		}
	}
}

// Exports class singleton to prevent multiple invocations of acquireVsCodeApi.
export const vscode = new VSCodeAPIWrapper()

// RPC "invoke" simple (request/response avec id)
type Pending = { resolve: (v: any) => void; reject: (e: any) => void }
const pending = new Map<string, Pending>()

function uid() {
	return Math.random().toString(36).slice(2)
}

export function invoke<T = any>(command: string, payload?: any): Promise<T> {
	const id = uid()
	return new Promise<T>((resolve, reject) => {
		pending.set(id, { resolve, reject })
		// Type assertion to bypass TypeScript check for RPC messages
		;(vscode.postMessage as any)({ __rpc: true, id, command, payload })
		// timeout safe-guard 8s
		setTimeout(() => {
			if (pending.has(id)) {
				pending.delete(id)
				reject(new Error(`RPC timeout for ${command}`))
			}
		}, 8000)
	})
}

// Handler messages depuis l'extension
window.addEventListener("message", (event) => {
	const msg = event.data
	if (!msg || !msg.__rpc) return
	const p = pending.get(msg.replyTo)
	if (!p) return
	pending.delete(msg.replyTo)
	if (msg.error) p.reject(new Error(msg.error))
	else p.resolve(msg.result)
})

// Nouveau helper : messages typés "supervisor:get"/"supervisor:set"
export function sendTyped(type: "supervisor:get" | "supervisor:set", payload?: any) {
	vscode.postMessage({ type, payload })
}

// Fallback RPC (compat) uniquement si nécessaire
export async function sendWithCompat(type: "supervisor:get" | "supervisor:set", payload?: any): Promise<any> {
	return new Promise((resolve, reject) => {
		let resolved = false
		const cleanup = () => window.removeEventListener("message", onMessage)

		const onMessage = (event: MessageEvent) => {
			const msg = event.data
			if (!msg || resolved) {
				return
			}

			// Typed supervisor config responses from the extension
			if (msg.type === "supervisorConfig") {
				resolved = true
				cleanup()
				if (msg.error) {
					reject(new Error(typeof msg.error === "string" ? msg.error : "supervisorConfig error"))
				} else {
					resolve(msg.config ?? msg.payload ?? msg.result ?? null)
				}
				return
			}

			if (msg.type === "supervisor:result" || msg.type === "supervisor:error") {
				resolved = true
				cleanup()
				if (msg.type === "supervisor:error") {
					reject(msg.error || "supervisor:error")
				} else {
					resolve(msg.payload ?? msg.result ?? true)
				}
				return
			}

			// Compat RPC (si l'extension répond en RPC)
			if (msg.__rpc === true && (msg.result !== undefined || msg.error !== undefined)) {
				resolved = true
				cleanup()
				if (msg.error) {
					reject(msg.error)
				} else {
					resolve(msg.result)
				}
			}
		}

		window.addEventListener("message", onMessage)
		try {
			sendTyped(type, payload)
			setTimeout(() => {
				if (!resolved) {
					cleanup()
					reject(new Error("timeout"))
				}
			}, 8000)
		} catch (e) {
			cleanup()
			reject(e)
		}
	})
}

// kilocode_change start
// Make vscode available globally - this allows the playwright tests
// to post messages directly so we can setup provider credentials
// without having to go through the Settings UI in every test.
if (typeof window !== "undefined") {
	;(window as unknown as { vscode: VSCodeAPIWrapper }).vscode = vscode
}
// kilocode_change end

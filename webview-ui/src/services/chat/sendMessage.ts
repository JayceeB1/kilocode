// Exemple de hook pipeline : si Supervisor ON, on pourrait appeler un guard local
// Ici c'est un stub no-op pour garder la PR petite. À intégrer dans le flux réel si nécessaire.
// import { invoke } from "../../utils/vscode";
// import { useSupervisor } from "../../state/supervisorSlice";

export async function maybeGuardPrompt(prompt: string): Promise<string> {
	// NOTE: dans un vrai flux, on lirait l'état via un store global accessible ici.
	// Pour ce stub minimal, on laisse tel quel.
	return prompt
}

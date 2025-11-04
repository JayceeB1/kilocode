import { defineConfig } from "tsup"

export default defineConfig({
	entry: ["src/index.ts"],
	format: ["esm"],
	dts: { only: true },
	clean: true,
	sourcemap: true,
})

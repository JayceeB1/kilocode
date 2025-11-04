import { config } from "@roo-code/config-eslint/base"

export default [
	...config,
	{
		rules: {
			"@typescript-eslint/explicit-function-return-type": "off",
			"@typescript-eslint/explicit-module-boundary-types": "off",
			"@typescript-eslint/no-explicit-any": "warn",
			"@typescript-eslint/no-non-null-assertion": "warn",
		},
	},
	{
		ignores: ["build/**", "out/**", "coverage/**", "**/*.js", "!**/*.cjs"],
	},
]

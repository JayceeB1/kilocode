# Smart Patcher CLI

The Smart Patcher CLI provides a command-line interface for executing patch plans with support for dry-run mode, custom task envelopes, and comprehensive error handling and reporting.

## Usage

```bash
# Run in dry-run mode (no actual file changes)
patch --dry-run < plan.json

# Run with a custom task envelope
patch --envelope custom-envelope.json < plan.json

# Run with default conservative envelope
patch < plan.json

# Show help
patch --help
```

## Command Line Options

- `--dry-run`: Run in dry-run mode (no actual file changes)
- `--envelope <path>`: Path to TaskEnvelope.json file
- `--help, -h`: Show help message

## Input Format

The CLI expects a PatchPlan JSON object from stdin. The PatchPlan should have the following structure:

```json
{
	"id": "unique-plan-id",
	"ops": [
		{
			"id": "op1",
			"strategy": "strict",
			"filePath": "path/to/file.txt",
			"type": "search_replace",
			"search": "old text",
			"replace": "new text"
		}
	],
	"metadata": {
		"description": "Optional description of the plan"
	}
}
```

## Output Format

The CLI outputs a JSON result object with the following structure:

```json
{
	"ok": true,
	"changed": true,
	"outcome": "success",
	"hashBefore": "sha256-hash-before",
	"hashAfter": "sha256-hash-after",
	"errorReport": [],
	"remediationPlan": {}
}
```

## Security

The CLI applies security constraints to ensure safe patching:

- Local-first constraint (no remote operations)
- Port range restriction (9600-9699)
- Prevents binding to 0.0.0.0
- Denies access to system directories and sensitive files

## Directories

The CLI creates and uses the following directories:

- `.kilocode/`: Main directory for CLI data
- `.kilocode/patch-plans/`: Stores patch plan registry
- `.kilocode/patch-reports/`: Stores error reports

## Error Handling

When errors occur, the CLI:

1. Writes detailed error reports to `.kilocode/patch-reports/`
2. Updates the registry with observations and suggested fixes
3. Exits with code 1 to indicate failure
4. Provides meaningful error messages

## Examples

### Dry Run

```bash
echo '{"id":"test","ops":[{"id":"op1","strategy":"strict","filePath":"test.txt","type":"search_replace","search":"old","replace":"new"}]}' | patch --dry-run
```

### Apply Changes

```bash
echo '{"id":"test","ops":[{"id":"op1","strategy":"strict","filePath":"test.txt","type":"search_replace","search":"old","replace":"new"}]}' | patch
```

### Custom Envelope

```bash
echo '{"id":"test","ops":[...]}' | patch --envelope my-envelope.json
```

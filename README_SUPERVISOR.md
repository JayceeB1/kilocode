# Local Supervisor Documentation

## Overview

Kilo Code Local Supervisor provides on-device code analysis and auto-fix capabilities using local LLM models. It offers enhanced privacy and offline operation while maintaining the same powerful analysis features as the cloud-based solution.

### Key Benefits

- **Local-First Processing**: All code analysis happens on your machine
- **Enhanced Privacy**: No code sent to external services
- **Offline Operation**: Works without internet connection
- **Terminal Integration**: Automatically captures and analyzes failed command outputs
- **Problem Matching**: Integrates with VS Code's problem panel
- **Auto-fix Suggestions**: Provides intelligent fix suggestions with confidence scores

### Architecture

The Local Supervisor consists of:

- **Supervisor Service**: A local HTTP service that handles analysis requests
- **VS Code Integration**: Extension components that communicate with the service
- **Local LLM Provider**: Integration with Ollama, llama.cpp, and other local providers

## Orchestrateur Kilo CODE — Prompts

### System Prompts

The Local Supervisor uses specialized system prompts to guide its behavior:

```text
You are Kilo Code Local Supervisor, an AI assistant that analyzes code and terminal errors locally.

Your primary responsibilities:
1. Analyze code issues and terminal errors
2. Provide fix suggestions with confidence scores
3. Explain problems in clear, actionable terms
4. Suggest specific code changes when appropriate

Security and Privacy Guidelines:
- All processing happens locally on the user's machine
- Never send code or personal data to external services
- Respect the local-first architecture
- Only access files explicitly provided by the user

Analysis Process:
1. Identify the root cause of issues
2. Evaluate multiple potential solutions
3. Rank solutions by confidence and impact
4. Provide step-by-step fix instructions
5. Include verification steps when possible
```

### User Prompts

Common user interaction patterns:

#### Error Analysis

```
Analyze this error and suggest fixes:
[Error message/output]
```

#### Code Review

```
Review this code for potential issues:
[Code snippet]
```

#### Fix Verification

```
I applied this fix, can you verify it's correct:
[Applied changes]
```

### Prompt Templates

The supervisor supports various prompt templates for different scenarios:

#### Terminal Error Analysis

```text
Terminal command failed: {command}
Error output: {error}
Working directory: {cwd}
Context: {context}

Please analyze this error and provide:
1. Root cause identification
2. Step-by-step fix instructions
3. Verification commands
4. Confidence score (0-1)
```

#### Code Issue Resolution

```text
File: {file_path}
Issue: {issue_description}
Code context: {surrounding_code}

Please provide:
1. Problem explanation
2. Specific code changes needed
3. Potential side effects
4. Confidence score (0-1)
```

## Runbook (Verify → Plan → Fix → Test → Report)

### 1. Verify

**Purpose**: Identify and validate issues in the codebase

**Process**:

- Monitor terminal command outputs for errors
- Parse VS Code problem panel diagnostics
- Validate file syntax and structure
- Check for common patterns (missing deps, path issues, etc.)

**Output**: Validated issue list with severity ratings

### 2. Plan

**Purpose**: Develop strategy for addressing identified issues

**Process**:

- Prioritize issues by impact and complexity
- Identify dependencies between issues
- Plan fix order to minimize conflicts
- Estimate effort and risks

**Output**: Prioritized action plan with resource estimates

### 3. Fix

**Purpose**: Implement solutions with confidence scoring

**Process**:

- Generate specific code changes
- Provide step-by-step instructions
- Include confidence scores for each suggestion
- Offer alternative solutions when appropriate

**Output**: Actionable fix suggestions with implementation guidance

### 4. Test

**Purpose**: Validate applied fixes and ensure no regressions

**Process**:

- Suggest verification commands
- Recommend test cases
- Check for potential side effects
- Validate syntax and structure

**Output**: Verification steps and test recommendations

### 5. Report

**Purpose**: Document changes and outcomes

**Process**:

- Summarize applied changes
- Document resolution status
- Note any remaining issues
- Suggest preventive measures

**Output**: Comprehensive change report with status summary

## Security Considerations

### Local-First Architecture

The Local Supervisor is designed with security and privacy as primary concerns:

#### Network Binding

- **Default**: Binds to `127.0.0.1` only
- **Forbidden**: 0.0.0.0 binding — seule l'IP 127.0.0.1 est acceptée (LAN 10.0.4.0/24 activable explicitement)
- **Port Range**: Restricted to 9600-9699 (default: 9611)
- **Firewall**: No external network access required

#### Data Privacy

- **No Telemetry**: All analysis happens locally
- **No Data Exfiltration**: Code never leaves your machine
- **Local Storage**: All data stored in `.kilocode` directory
- **No Cloud Dependencies**: Works completely offline

#### Sandboxing

- **Isolated Process**: Supervisor runs in separate process
- **Limited File Access**: Only accesses explicitly provided files
- **Resource Limits**: Configurable memory and CPU limits
- **Permission Model**: Requires explicit user approval for changes

#### Configuration Security

- **No Secrets in Logs**: Sensitive data is redacted
- **Local Config Only**: No remote configuration fetching
- **User Control**: All features require explicit opt-in
- **Audit Trail**: Optional logging of all actions

### Best Practices

1. **Network Security**

    - Never expose supervisor service to external networks
    - Use firewall rules to restrict access if needed
    - Verify port bindings before starting service

2. **Data Protection**

    - Regularly review `.kilocode` directory contents
    - Exclude sensitive files from analysis
    - Use `.kilocodeignore` for additional privacy

3. **Access Control**

    - Limit who can access your development machine
    - Use OS-level user permissions appropriately
    - Consider using dedicated development environment

4. **Monitoring**
    - Review supervisor logs periodically
    - Monitor resource usage
    - Validate auto-fix suggestions before applying

## Configuration

### Basic Setup

1. Install a local LLM provider (Ollama recommended)
2. Download a compatible model
3. Start the supervisor service
4. Configure VS Code settings

### Configuration File

Create `.kilocode/supervisor.config.json` in your project root:

```json
{
	"bind": "127.0.0.1",
	"port": 9611,
	"provider": "ollama",
	"model": "llama3.1:8b-instruct-q4",
	"max_tokens": 768,
	"temperature": 0.2,
	"autoFixWhitelist": ["path_not_found", "missing_dep", "flaky_test_rerun"],
	"autoFixMinConfidence": 0.75,
	"reflexion": {
		"enabled": true,
		"maxItems": 128,
		"ttlDays": 60
	},
	"security": {
		"allowLan": false,
		"requireAuthentication": false,
		"maxRequestSize": "10MB"
	},
	"logging": {
		"level": "info",
		"file": ".kilocode/.logs/supervisor.log"
	}
}
```

### Provider Configuration

#### Ollama

```json
{
	"provider": "ollama",
	"baseUrl": "http://127.0.0.1:11434",
	"model": "llama3.1:8b-instruct-q4"
}
```

#### llama.cpp

```json
{
	"provider": "llamacpp",
	"baseUrl": "http://127.0.0.1:8080",
	"model": "path/to/model.gguf"
}
```

### Security Settings

```json
{
	"security": {
		"allowLan": false,
		"requireAuthentication": false,
		"maxRequestSize": "10MB",
		"allowedPaths": ["/workspace"],
		"blockedPaths": ["/etc", "/usr", "~/.ssh"]
	}
}
```

## Troubleshooting

### Common Issues

1. **Service Won't Start**

    - Check if port is already in use
    - Verify LLM provider is running
    - Check configuration file syntax

2. **Connection Refused**

    - Ensure supervisor service is running
    - Verify VS Code settings point to correct URL
    - Check firewall settings

3. **Poor Analysis Quality**

    - Try a more capable model
    - Increase temperature slightly (0.3-0.5)
    - Provide more context in errors

4. **Performance Issues**
    - Reduce max_tokens for faster responses
    - Use quantized models
    - Limit concurrent requests

### Debug Mode

Enable debug logging by setting:

```json
{
	"logging": {
		"level": "debug",
		"file": ".kilocode/.logs/supervisor.log"
	}
}
```

## Contributing

The Local Supervisor is open source and welcomes contributions. Please see the main project's contributing guidelines for details.

### Development Setup

1. Clone the repository
2. Install dependencies with `pnpm install`
3. Run `pnpm supervisor:dev` for development mode
4. Make changes and test with local LLM

### Security Reporting

For security-related issues, please follow the project's security reporting policy and avoid disclosing details in public issues.

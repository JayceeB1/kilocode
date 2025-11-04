<p align="center">
  <a href="https://marketplace.visualstudio.com/items?itemName=kilocode.Kilo-Code"><img src="https://img.shields.io/visual-studio-marketplace/v/kilocode.Kilo-Code.svg?label=VS%20Code%20Marketplace" alt="VS Code Marketplace"></a>
  <a href="https://x.com/kilocode"><img src="https://img.shields.io/twitter/follow/kilocode?style=flat&logo=x&color=555" alt="X (Twitter)"></a>
  <a href="https://blog.kilocode.ai"><img src="https://img.shields.io/badge/Blog-555?style=flat&logo=substack&logoColor=white" alt="Substack Blog"></a>
  <a href="https://kilocode.ai/discord"><img src="https://img.shields.io/discord/1349288496988160052?style=flat&logo=discord&logoColor=white" alt="Discord"></a>
  <a href="https://www.reddit.com/r/kilocode/"><img src="https://img.shields.io/reddit/subreddit-subscribers/kilocode?style=flat&logo=reddit&logoColor=white" alt="Reddit"></a>
</p>

# 🚀 Kilo Code

> Kilo is an open-source VS Code AI agent. We frequently merge features from open-source projects while building our own vision.

- ✨ Generate code from natural language
- ✅ Checks its own work
- 🧪 Run terminal commands
- 🌐 Automate the browser
- 🤖 Latest AI models
- 🎁 API keys optional
- 💡 **Get $20 in bonus credits when you top-up for the first time** Credits can be used with 400+ models like Gemini 2.5 Pro, Claude 4 Sonnet & Opus, and GPT-5

<p align="center">
  <img src="https://raw.githubusercontent.com/Kilo-Org/kilocode/refs/heads/main/kilo.gif" width="100%" />
</p>

- [VS Code Marketplace](https://kilocode.ai/vscode-marketplace?utm_source=Readme) (download)
- [Official KiloCode.ai Home page](https://kilocode.ai) (learn more)

## Key Features

- **Code Generation:** Kilo can generate code using natural language.
- **Task Automation:** Kilo can automate repetitive coding tasks.
- **Automated Refactoring:** Kilo can refactor and improve existing code.
- **MCP Server Marketplace**: Kilo can easily find, and use MCP servers to extend the agent capabilities.
- **Multi Mode**: Plan with Architect, Code with Coder, and Debug with Debugger, and make your own custom modes.

## How to get started with Kilo Code

1. Install the Kilo Code extension from the [VS Code Marketplace](https://marketplace.visualstudio.com/items?itemName=kilocode.Kilo-Code).
2. Create your account to access 400+ cutting-edge AI models including Gemini 2.5 Pro, Claude 4 Sonnet & Opus, and GPT-5 – with transparent pricing that matches provider rates exactly.
3. Start coding with AI that adapts to your workflow. Watch our quick-start guide to see Kilo Code in action:

[![Watch the video](https://img.youtube.com/vi/pqGfYXgrhig/maxresdefault.jpg)](https://youtu.be/pqGfYXgrhig)

## Local Supervisor

KiloCode Local Supervisor provides on-device code analysis and auto-fix capabilities using local LLM models. It offers enhanced privacy and offline operation while maintaining the same powerful analysis features.

### Quickstart

1. **Install Ollama** (required for local LLM):

    ```bash
    # macOS
    brew install ollama

    # Linux
    curl -fsSL https://ollama.ai/install.sh | sh

    # Windows
    # Download from https://ollama.ai/download
    ```

2. **Download a model**:

    ```bash
    ollama pull llama3.1:8b-instruct-q4
    ```

3. **Start the supervisor service**:

    ```bash
    # From the kilocode repository root
    pnpm supervisor:dev
    ```

4. **Configure VS Code**:
    - Open VS Code settings
    - Search for "KiloCode Supervisor"
    - Enable "kilo-code.supervisor.enabled"
    - Set "kilo-code.supervisor.serviceUrl" to `http://127.0.0.1:43110`

### Features

- **Local Analysis**: Code analysis runs entirely on your machine
- **Terminal Capture**: Automatically captures and analyzes failed command outputs
- **Problem Matching**: Integrates with VS Code's problem panel
- **Auto-fix Suggestions**: Provides intelligent fix suggestions with confidence scores
- **Privacy First**: No code sent to external services

### Configuration

Create `.kilocode/supervisor.config.json` in your project root:

```json
{
	"bind": "127.0.0.1",
	"port": 43110,
	"provider": "ollama",
	"model": "llama3.1:8b-instruct-q4",
	"max_tokens": 768,
	"temperature": 0.2,
	"autoFixWhitelist": ["path_not_found", "missing_dep", "flaky_test_rerun"],
	"autoFixMinConfidence": 0.75,
	"reflexion": { "enabled": true, "maxItems": 128, "ttlDays": 60 }
}
```

### Security & Privacy

- **Localhost Only**: Supervisor service only accepts connections from localhost
- **No Telemetry**: All analysis happens locally, no data sent externally
- **Configurable Policies**: Fine-grained control over auto-fix behavior
- **Sandboxed Execution**: Service runs in isolated environment

### Local Supervisor UI Integration

The Local Supervisor configuration is accessible through **Settings → Local Supervisor** in the VS Code extension.

**Security Policy:**

- Default bind: **127.0.0.1**. **Forbidden**: `0.0.0.0`
- Port range: **9600–9699** (default: **9611**)
- No secrets in clear text within logs

**Configuration File:**
`.kilocode/supervisor.config.json` — persists options (enable, port, bind, provider, endpoint, model, tokens, temperature, allowLAN).

**Usage:**

- Toggle via **SV ON/OFF** button in chat toolbar (shortcut: `Ctrl+Alt+L`)
- Settings changes are applied immediately via IPC

### Development

For details on building and developing the extension, see [DEVELOPMENT.md](/DEVELOPMENT.md)

For Local Supervisor development details, see [README_SUPERVISOR.md](/README_SUPERVISOR.md)

## Contributors to Kilo

Thanks to all the contributors who help make Kilo Code better!

<table>
  <tr>
    <td align="center">
      <a href="https://github.com/mcowger">
        <img src="https://avatars.githubusercontent.com/u/1929548?size=100" width="100" height="100" alt="mcowger" style="border-radius: 50%;" />
      </a>
    </td>    <td align="center">
      <a href="https://github.com/bhaktatejas922">
        <img src="https://avatars.githubusercontent.com/u/26863466?size=100" width="100" height="100" alt="bhaktatejas922" style="border-radius: 50%;" />
      </a>
    </td>    <td align="center">
      <a href="https://github.com/NyxJae">
        <img src="https://avatars.githubusercontent.com/u/52313587?size=100" width="100" height="100" alt="NyxJae" style="border-radius: 50%;" />
      </a>
    </td>    <td align="center">
      <a href="https://github.com/Aikiboy123">
        <img src="https://avatars.githubusercontent.com/u/161741275?size=100" width="100" height="100" alt="Aikiboy123" style="border-radius: 50%;" />
      </a>
    </td>    <td align="center">
      <a href="https://github.com/cobra91">
        <img src="https://avatars.githubusercontent.com/u/1060585?size=100" width="100" height="100" alt="cobra91" style="border-radius: 50%;" />
      </a>
    </td>
  </tr>
  <tr>
    <td align="center">
      <a href="https://github.com/ivanarifin">
        <img src="https://avatars.githubusercontent.com/u/111653938?size=100" width="100" height="100" alt="ivanarifin" style="border-radius: 50%;" />
      </a>
    </td>    <td align="center">
      <a href="https://github.com/PeterDaveHello">
        <img src="https://avatars.githubusercontent.com/u/3691490?size=100" width="100" height="100" alt="PeterDaveHello" style="border-radius: 50%;" />
      </a>
    </td>    <td align="center">
      <a href="https://github.com/possible055">
        <img src="https://avatars.githubusercontent.com/u/38576169?size=100" width="100" height="100" alt="possible055" style="border-radius: 50%;" />
      </a>
    </td>    <td align="center">
      <a href="https://github.com/seuros">
        <img src="https://avatars.githubusercontent.com/u/2394703?size=100" width="100" height="100" alt="seuros" style="border-radius: 50%;" />
      </a>
    </td>    <td align="center">
      <!-- added this line to test github action -->
      <a href="https://kilocode.ai/#contributors">
        <b>more ...</b>
      </a>
    </td>
  </tr>
</table>

## Local Supervisor (experimental)

Kilo Code Local Supervisor provides on-device code analysis and auto-fix capabilities using local LLM models. It offers enhanced privacy and offline operation while maintaining the same powerful analysis features.

For detailed documentation, see [README_SUPERVISOR.md](README_SUPERVISOR.md).

<!-- END CONTRIBUTORS SECTION -->

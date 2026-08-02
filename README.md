# Prompt Playground

A browser-based sandbox for iterating on LLM prompts. Compose multi-turn message sequences, test them against DeepSeek, observe tool-calling decisions, and iterate — all data stays in your browser's localStorage. No backend required.

## Features

- **Multi-turn message editor** — compose messages with system, human, AI, and tool roles. Add, reorder, or delete freely.
- **Streaming output** — real-time streaming via DeepSeek, with token usage stats.
- **Tool-call observation** — 15 default mock tools (AST search, code reading, git, web search, etc.). All tools are editable — add, edit, or delete any tool. Import/export tool definitions as JSON. Bind tools to a prompt, run it, and observe which tools the model calls and with what arguments — execution is mocked, no real side effects.
- **Run history** — each run is auto-named and saves streaming output, tool-call traces, and token stats. Browse, rename, and review past runs.
- **Feedback system** — star ratings, tags, and comments to track prompt quality over time.
- **Rendered / Raw dual view** — toggle between a clean rendered view (text + tool-call cards) and the raw LangChain `AIMessage` JSON.
- **Group organization** — organize prompts into groups.
- **Data management** — browse all entities (groups, prompts, runs, settings) in Cards or Raw view. Import/export as `.jsonl` files.
- **Fully local** — all data persists in localStorage (JSONL format). No servers, databases, or accounts. Your API key stays on your machine.

## Tech Stack

| Layer | Tech |
|---|---|
| UI | React 19 + Tailwind CSS 4 |
| LLM | LangChain JS (`@langchain/deepseek`) |
| Model | DeepSeek Chat API |
| Icons | Lucide React |
| Build | Vite 8 |

## Getting Started

### Prerequisites

- Node.js 18+
- [DeepSeek API Key](https://platform.deepseek.com/api_keys)

### Install & Run

```bash
npm install
npm run dev
```

Open `http://localhost:7991`, click the gear icon in the top-right corner to set your API Key, and start composing prompts.

### Production Build

```bash
npm run build
npm run preview
```

## Usage Guide

### Basic Chat

1. Write a system message and a human message.
2. Click **Run** (or press `Ctrl+Enter`).
3. Watch the response stream in real time.
4. Rate the output with stars, tags, and comments.

### Testing Tool Calls

1. Click the **Tools** button to open the split-pane tool panel.
2. Left side: check the tools you want to bind. Right side: add, edit, or delete any tool — provide a name, description, args JSON schema, and default mock output. You can also import/export tools as JSON.

#### Scanning @tool Functions from Python Code

Use the included scanner script to extract tool definitions from your Python project:

```bash
# Scan a directory and print JSON to stdout
python scripts/scan_tools.py /path/to/your/project

# Write to a file, then import via the Tools panel
python scripts/scan_tools.py /path/to/your/project -o my_tools.json

# Pretty-printed output
python scripts/scan_tools.py /path/to/your/project --pretty
```

The scanner detects `@tool`-decorated functions, extracts:
- **Function name** → tool name
- **Docstring** or `@tool("desc")` argument → description
- **Type hints** (`str`, `int`, `bool`, `list[X]`, `Optional[X]`, `Literal[...]`) → JSON schema types
- **Default values** → optional parameters (omitted from `required`)
- **Google-style docstring** `Args:` section → per-parameter descriptions

Function bodies are **not** extracted — tool execution is always mocked.
3. Write a prompt likely to trigger tool use (e.g., "find all functions related to authentication").
4. Click **Run** — the model makes a single decision: reply directly, or invoke one or more tools.
5. Switch between **Rendered** view (text + tool-call cards) and **Raw** view (full LangChain `AIMessage` JSON with `tool_calls`, `usage_metadata`, `response_metadata`).

### Organizing Work

- **Groups** (left sidebar) — create folders like "Code Review", "Docs", or "Experiments".
- **Prompts** live inside groups. Each prompt is a set of messages + tool bindings.
- **Runs** appear under each prompt. Each run record includes input messages, output, and metadata.

### Data Management

- Click **Data** in the toolbar to open the data manager.
- **Cards** view: browse records as cards. **Raw** view: edit the underlying JSONL text directly.
- Export any entity as a `.jsonl` file for version control or sharing.
- Import `.jsonl` files to restore or seed data.

## Settings

Configured via **Settings** (gear icon):

| Option | Default | Description |
|---|---|---|
| API Key | *(required)* | Your DeepSeek API key |
| Base URL | `https://api.deepseek.com/v1` | API endpoint (supports proxies) |
| Model | `deepseek-chat` | Model name |

Temperature is fixed at `0` for deterministic output. `max_tokens` is left unset (model default).

## Tools

15 default tools are seeded into localStorage on first launch:

| Category | Tools |
|---|---|
| Code Search | `ast_search`, `find_symbol_definition`, `find_symbol_references` |
| Code Reading | `read_file`, `inspect_file_summary`, `inspect_project` |
| Code Editing | `write_to_file`, `create_file`, `delete_files`, `apply_search_replace` |
| Analysis | `static_check` |
| Environment | `get_environment_variable` |
| Web / Time | `web_search`, `get_current_time` |
| Setup | `setup_spec_environment` |

Every tool is **fully editable** — you can modify, delete, or add new tools via the Tools panel. Tool definitions can also be **imported/exported** as JSON files. Execution is always **mocked** (fake results), so you can iterate on prompt design without a real tool backend.

## Project Structure

```
prompt-playground/
├── public/                # Static assets
├── src/
│   ├── main.jsx           # Entry point
│   ├── App.jsx            # Main app: state management, orchestration
│   ├── Sidebar.jsx        # Left nav: Groups, Prompts, Runs
│   ├── MessageEditor.jsx  # Multi-turn message editor
│   ├── RunPanel.jsx       # Run output display (Rendered / Raw views)
│   ├── SettingsModal.jsx  # API Key and model settings
│   ├── DataModal.jsx      # Data manager (Cards / Raw, import / export)
│   ├── ToolsModal.jsx     # Tool management (split-pane: list + edit form, import/export)
│   ├── store.js           # localStorage JSONL persistence layer
│   ├── llm.js             # LangChain DeepSeek integration
│   ├── tools.js           # Tool registry (reads from store)
│   └── default-tools.js   # Default tool definitions (seeded on first launch)
├── scripts/
│   └── scan_tools.py       # Scan Python @tool functions → importable JSON
├── index.html
├── package.json
└── vite.config.js
```

Data flow: user edits prompt → `App.jsx` orchestrates → `llm.js` calls DeepSeek → results saved via `store.js` → UI rendered by `RunPanel.jsx`. All persistence goes through `store.js` into localStorage (newline-delimited JSON format).

## License

MIT

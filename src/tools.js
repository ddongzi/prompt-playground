// Built-in tool registry for agent prompt testing.
//
// Each tool is described by name + description + an args JSON schema — exactly
// what the LLM sees when bound via `model.bindTools()`. Tool *execution* is
// mocked in the playground (see runWithTools in llm.js): we only observe the
// model's decisions (which tool, which args) and feed back canned results.
//
// Descriptions are best-effort guesses; refine them to match your real Python
// tools so the model's routing matches production behaviour.

import { listCustomTools } from './store'

export const BUILTIN_TOOLS = [
  {
    name: 'ast_search',
    description:
      'Search the project AST for code symbols (functions, classes, methods) whose name or signature matches a query. Returns matching symbols with file path and line range.',
    schema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Symbol name or pattern to search for.' },
        symbol_type: {
          type: 'string',
          enum: ['function', 'class', 'method', 'any'],
          description: 'Restrict the search to a symbol kind.',
        },
      },
      required: ['query'],
    },
  },
  {
    name: 'get_environment_variable',
    description: 'Read the value of an environment variable from the current process.',
    schema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'The environment variable name.' },
      },
      required: ['name'],
    },
  },
  {
    name: 'read_file',
    description: 'Read the contents of a file, optionally a specific line range.',
    schema: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'Absolute or project-relative file path.' },
        start_line: { type: 'integer', description: '1-based first line to read (inclusive).' },
        end_line: { type: 'integer', description: '1-based last line to read (inclusive).' },
      },
      required: ['path'],
    },
  },
  {
    name: 'create_file',
    description: 'Create a new file with the given content. Fails if the file already exists.',
    schema: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'Path of the file to create.' },
        content: { type: 'string', description: 'Full file content.' },
      },
      required: ['path', 'content'],
    },
  },
  {
    name: 'inspect_project',
    description:
      'View project structure and metadata: files, directories, project root, etc.',
    schema: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'Project root path (defaults to cwd).' },
      },
      required: [],
    },
  },
  {
    name: 'write_to_file',
    description: 'Overwrite an existing file with new content. Creates the file if it does not exist.',
    schema: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'Path of the file to write.' },
        content: { type: 'string', description: 'Full file content to write.' },
      },
      required: ['path', 'content'],
    },
  },
  {
    name: 'delete_files',
    description: 'Delete one or more files from disk.',
    schema: {
      type: 'object',
      properties: {
        paths: {
          type: 'array',
          items: { type: 'string' },
          description: 'List of file paths to delete.',
        },
      },
      required: ['paths'],
    },
  },
  {
    name: 'inspect_file_summary',
    description: 'Return a concise summary of a file: size, line count, top-level symbols, imports, and a short description.',
    schema: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'Path of the file to summarize.' },
      },
      required: ['path'],
    },
  },
  {
    name: 'static_check',
    description: 'Run static analysis / lint / type-check on the project or a target path and return diagnostics.',
    schema: {
      type: 'object',
      properties: {
        target: { type: 'string', description: 'File or directory to check (defaults to project root).' },
        checks: {
          type: 'array',
          items: { type: 'string', enum: ['lint', 'types', 'imports'] },
          description: 'Which checks to run.',
        },
      },
      required: [],
    },
  },
  {
    name: 'find_symbol_definition',
    description: 'Locate the definition site of a symbol (function/class/method) and return its file path and line number.',
    schema: {
      type: 'object',
      properties: {
        symbol: { type: 'string', description: 'The symbol name to resolve.' },
      },
      required: ['symbol'],
    },
  },
  {
    name: 'find_symbol_references',
    description: 'Find all references/usages of a symbol across the project. Returns a list of locations (file + line).',
    schema: {
      type: 'object',
      properties: {
        symbol: { type: 'string', description: 'The symbol name to find references for.' },
      },
      required: ['symbol'],
    },
  },
  {
    name: 'apply_search_replace',
    description: 'Apply a search-and-replace edit to a file: replace the first occurrence of `search` with `replace`.',
    schema: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'Path of the file to edit.' },
        search: { type: 'string', description: 'Exact text to find.' },
        replace: { type: 'string', description: 'Replacement text.' },
      },
      required: ['path', 'search', 'replace'],
    },
  },
  {
    name: 'setup_spec_environment',
    description: 'Initialize or reset the spec/feature environment for a given specification (creates scaffold dirs and config).',
    schema: {
      type: 'object',
      properties: {
        spec: { type: 'string', description: 'Specification identifier or name.' },
      },
      required: ['spec'],
    },
  },
  {
    name: 'get_current_time',
    description: 'Return the current date and time (ISO 8601) in the configured local timezone.',
    schema: {
      type: 'object',
      properties: {},
      required: [],
    },
  },
  {
    name: 'web_search',
    description: 'Search the web for a query and return the top results (title, url, snippet).',
    schema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'The search query.' },
        max_results: { type: 'integer', description: 'Maximum number of results to return.' },
      },
      required: ['query'],
    },
  },
]

const BY_NAME = new Map(BUILTIN_TOOLS.map((t) => [t.name, t]))

function customToolMap() {
  const map = new Map()
  for (const t of listCustomTools()) {
    map.set(t.name, {
      name: t.name,
      description: t.description,
      schema: t.schema,
      mock_output: t.mock_output,
      _id: t.id,
      _custom: true,
    })
  }
  return map
}

export function getToolByName(name) {
  return BY_NAME.get(name) || customToolMap().get(name) || null
}

// List all tools (built-in + custom) for the UI.
export function getAllTools() {
  const builtins = BUILTIN_TOOLS.map((t) => ({ ...t, _custom: false }))
  const customs = listCustomTools().map((t) => ({
    name: t.name,
    description: t.description,
    schema: t.schema,
    mock_output: t.mock_output,
    _id: t.id,
    _custom: true,
  }))
  return [...builtins, ...customs]
}

// Build the bindTools input for the given selected tool names.
export function buildToolDefs(selectedNames) {
  const cmap = customToolMap()
  const out = []
  for (const name of selectedNames || []) {
    const t = BY_NAME.get(name) || cmap.get(name)
    if (t) out.push({ name: t.name, description: t.description, schema: t.schema })
  }
  return out
}

// Default mock returned when a tool is invoked with no user-supplied mock.
// Echoes the call so you can see what the model passed in.
// For custom tools, uses their stored mock_output if available.
export function defaultMock(name, args) {
  const t = getToolByName(name)
  if (t?._custom && t.mock_output != null && t.mock_output !== '') {
    return t.mock_output
  }
  return JSON.stringify({ mocked: true, tool: name, args: args ?? {} }, null, 2)
}

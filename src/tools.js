// Tool registry for agent prompt testing.
//
// Every tool is stored in localStorage (pp.tools.jsonl) — there is no
// built-in vs. custom distinction at runtime.  On first launch the app
// seeds DEFAULT_TOOLS into the store.
//
// Each tool has name + description + an args JSON schema — exactly what
// the LLM sees when bound via `model.bindTools()`.  Execution is mocked
// (see runWithTools in llm.js).

import { listCustomTools } from './store'
export { default as DEFAULT_TOOLS } from './default-tools'

/* ---- runtime helpers (all read from the store) ---- */

function toolMap() {
  const map = new Map()
  for (const t of listCustomTools()) {
    map.set(t.name, {
      name: t.name,
      description: t.description,
      schema: t.schema,
      mock_output: t.mock_output,
      _id: t.id,
    })
  }
  return map
}

export function getToolByName(name) {
  return toolMap().get(name) || null
}

/** List every tool stored in localStorage. */
export function getAllTools() {
  return listCustomTools().map((t) => ({
    name: t.name,
    description: t.description,
    schema: t.schema,
    mock_output: t.mock_output,
    _id: t.id,
  }))
}

/** Build the `bindTools()` input for the given selected tool names. */
export function buildToolDefs(selectedNames) {
  const tmap = toolMap()
  const out = []
  for (const name of selectedNames || []) {
    const t = tmap.get(name)
    if (t) out.push({ name: t.name, description: t.description, schema: t.schema })
  }
  return out
}

/** Default mock returned when a tool is invoked with no user-supplied mock. */
export function defaultMock(name, args) {
  const t = toolMap().get(name)
  if (t && t.mock_output != null && t.mock_output !== '') {
    return t.mock_output
  }
  return JSON.stringify({ mocked: true, tool: name, args: args ?? {} }, null, 2)
}

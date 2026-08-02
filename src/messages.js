// Normalize a Python-exported LangChain message list into the native format:
//   { type: 'system'|'human'|'ai'|'tool', data: { content: string, tool_call_id?: string, name?: string, tool_calls?: [...] } }
//
// Accepts several shapes the user might paste from Python:
//   1) JSON array of flat dicts (m.model_dump()):
//        [{"type":"human","content":"..."}, {"type":"ai","content":"...", "tool_calls":[...]}, ...]
//   2) {"messages": [...]}  (messages_to_dict style, flat dicts)
//   3) {"messages": [{"lc":1,"type":"constructor","id":[...,"HumanMessage"],"kwargs":{...}}, ...]}  (messages_to_json)
//   4) OpenAI-style: [{"role":"user","content":"..."}, ...]
//   5) Native data-wrapped: [{"type":"human","data":{"content":"...",...}}]

const TYPE_MAP = {
  // python model_dump `type` values / OpenAI `role`
  system: 'system',
  human: 'human',
  user: 'human',
  ai: 'ai',
  assistant: 'ai',
  tool: 'tool',
  function: 'tool',
  chat: 'human',
  // langchain class names (lc serialized form, last element of `id`)
  SystemMessage: 'system',
  HumanMessage: 'human',
  AIMessage: 'ai',
  ToolMessage: 'tool',
  FunctionMessage: 'tool',
  ChatMessage: 'human',
}

// content in LC v0.2 can be a string OR a list of content blocks
// (e.g. [{type:'text', text:'...'}, {type:'tool_use', ...}]). Pull out the text.
function extractText(content) {
  if (content == null) return ''
  if (typeof content === 'string') return content
  if (Array.isArray(content)) {
    return content
      .map((b) => {
        if (typeof b === 'string') return b
        if (b && typeof b === 'object') {
          if (typeof b.text === 'string') return b.text
          if (typeof b.content === 'string') return b.content
        }
        return ''
      })
      .join('')
  }
  if (typeof content === 'object') {
    if (typeof content.text === 'string') return content.text
    if (typeof content.content === 'string') return content.content
  }
  return String(content)
}

// Normalize an AI message's tool_calls into { name, args, id, type: 'tool_call' }.
// args may be an object, a JSON string, or absent.
function normalizeToolCalls(tcs) {
  if (!Array.isArray(tcs)) return null
  const out = []
  for (const tc of tcs) {
    if (!tc || typeof tc !== 'object') continue
    let args = tc.args
    if (args == null) args = {}
    else if (typeof args === 'string') {
      try {
        args = JSON.parse(args)
      } catch {
        args = {}
      }
    }
    out.push({ name: tc.name || '', args, id: tc.id || '', type: 'tool_call' })
  }
  return out.length ? out : null
}

function fromFlat(d) {
  // Older LC serialization wraps the fields in `data`:
  //   {"type":"human","data":{"content":"...","type":"human","additional_kwargs":{},...}}
  // Newer model_dump() is flat: {"type":"human","content":"..."}
  const src = d.data && typeof d.data === 'object' ? d.data : d
  const rawType = d.type || src.type || src.role || src._type
  const outType = TYPE_MAP[rawType] || 'human'

  // Preserve the original data object, normalizing a handful of critical fields.
  const dataObj = { ...src, content: extractText(src.content) }
  dataObj.type = outType

  if (outType === 'tool') {
    if (src.tool_call_id != null) dataObj.tool_call_id = String(src.tool_call_id)
  }
  if (outType === 'ai') {
    const tcs = normalizeToolCalls(src.tool_calls)
    if (tcs) dataObj.tool_calls = tcs
  }
  return { type: outType, data: dataObj }
}

function fromLc(obj) {
  // {"lc":1,"type":"constructor","id":["langchain_core","messages","human","HumanMessage"],"kwargs":{...}}
  const id = Array.isArray(obj.id) ? obj.id[obj.id.length - 1] : null
  const kw = obj.kwargs || {}
  const outType = TYPE_MAP[id] || 'human'
  const dataObj = { content: extractText(kw.content) }
  if (outType === 'tool') {
    if (kw.tool_call_id != null) dataObj.tool_call_id = String(kw.tool_call_id)
    if (kw.name) dataObj.name = kw.name
  }
  if (outType === 'ai') {
    const tcs = normalizeToolCalls(kw.tool_calls)
    if (tcs) dataObj.tool_calls = tcs
  }
  return { type: outType, data: dataObj }
}

function normalizeItem(item) {
  if (item == null) return null
  if (typeof item === 'string') return { type: 'human', data: { content: item } }
  if (typeof item !== 'object') return null
  // lc-serialized constructor form?
  if (item.lc === 1 || (item.type === 'constructor' && item.kwargs)) {
    return fromLc(item)
  }
  return fromFlat(item)
}

export function parseImportedMessages(rawText) {
  const text = (rawText || '').trim()
  if (!text) return { ok: false, error: 'Paste a JSON message list first.' }
  let data
  try {
    data = JSON.parse(text)
  } catch (e) {
    return { ok: false, error: `Invalid JSON: ${e.message}` }
  }
  let list = data
  if (!Array.isArray(data)) {
    if (Array.isArray(data.messages)) list = data.messages
    else if (Array.isArray(data.data)) list = data.data
    else return { ok: false, error: 'Expected a JSON array, or {"messages": [...]}.' }
  }
  if (list.length === 0) return { ok: false, error: 'No messages found in the input.' }
  const out = []
  for (let i = 0; i < list.length; i++) {
    const m = normalizeItem(list[i])
    if (!m) return { ok: false, error: `Message #${i + 1}: unrecognized shape.` }
    out.push(m)
  }
  return { ok: true, messages: out }
}

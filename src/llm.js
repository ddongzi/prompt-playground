// LangChain JS integration with DeepSeek via the official @langchain/deepseek
// package (ChatDeepSeek).
//
// The LLM input is real LangChain Message objects (SystemMessage, HumanMessage,
// AIMessage, ToolMessage) built from the stored message dicts. Streaming is
// delivered as an async generator of events the UI consumes.

import { ChatDeepSeek } from '@langchain/deepseek'
import {
  SystemMessage,
  HumanMessage,
  AIMessage,
  ToolMessage,
} from '@langchain/core/messages'
import { buildToolDefs, defaultMock } from './tools'

const TYPE_MAP = {
  system: SystemMessage,
  human: HumanMessage,
  user: HumanMessage,
  ai: AIMessage,
  assistant: AIMessage,
  tool: ToolMessage,
}

// Convert stored message dicts into LangChain BaseMessage instances.
// Orphan tool messages (no preceding AI with matching tool_call_id) are skipped.
export function buildMessages(msgs) {
  return (msgs || [])
    .filter((m) => (m.content || '').trim() !== '' || m.type === 'tool' || (m.type === 'ai' && m.tool_calls))
    .reduce((acc, m) => {
      const t = (m.type || 'human').toLowerCase()
      if (t === 'tool') {
        // Only keep if the immediately preceding AI message has a matching tool_call id.
        const prev = acc[acc.length - 1]
        if (
          prev &&
          prev.constructor?.name === 'AIMessage' &&
          Array.isArray(prev.tool_calls) &&
          prev.tool_calls.some((tc) => tc.id === m.tool_call_id)
        ) {
          acc.push(new ToolMessage({
            content: m.content || '',
            tool_call_id: m.tool_call_id || '',
            name: m.name || undefined,
          }))
        }
        // else: orphan tool message — skip it silently.
        return acc
      }
      const cls = TYPE_MAP[t] || HumanMessage
      if (cls === AIMessage && m.tool_calls && m.tool_calls.length) {
        acc.push(new AIMessage({
          content: m.content || '',
          tool_calls: m.tool_calls.map((tc) => ({
            name: tc.name || '',
            args: tc.args ?? {},
            id: tc.id || '',
            type: 'tool_call',
          })),
        }))
        return acc
      }
      acc.push(new cls({ content: m.content || '' }))
      return acc
    }, [])
}

function createModel(settings, params) {
  const opts = {
    apiKey: settings.api_key,
    model: settings.model,
    temperature: params?.temperature ?? settings.temperature,
    maxTokens: params?.max_tokens ?? settings.max_tokens,
    streaming: true,
    streamUsage: true,
  }
  // ChatDeepSeek defaults to https://api.deepseek.com; only override when the
  // user has customised the endpoint (e.g. a proxy).
  if (settings.base_url) opts.configuration = { baseURL: settings.base_url }
  return new ChatDeepSeek(opts)
}

function extractDelta(content) {
  if (typeof content === 'string') return content
  if (Array.isArray(content)) {
    return content
      .map((p) => (typeof p === 'string' ? p : p?.text || ''))
      .join('')
  }
  return ''
}

// Async generator yielding events:
//   { type: 'token', delta } | { type: 'usage', usage } | { type: 'done' } | { type: 'error', message }
export async function* streamChat(messages, settings, params) {
  if (!settings?.api_key) {
    yield {
      type: 'error',
      message: 'DeepSeek API key not set. Open Settings (gear icon) to configure it.',
    }
    return
  }
  const lcMessages = buildMessages(messages)
  if (lcMessages.length === 0) {
    yield { type: 'error', message: 'No non-empty messages to send.' }
    return
  }

  let model
  try {
    model = createModel(settings, params)
  } catch (e) {
    yield { type: 'error', message: `Failed to initialise model: ${e.message}` }
    return
  }

  try {
    const stream = await model.stream(lcMessages)
    for await (const chunk of stream) {
      const delta = extractDelta(chunk.content)
      if (delta) yield { type: 'token', delta }
      const usage = chunk.usage_metadata
      if (usage) yield { type: 'usage', usage }
    }
    yield { type: 'done' }
  } catch (e) {
    yield { type: 'error', message: e?.message || 'LLM request failed' }
  }
}

// ---------- tool-calling (single-shot observation) ----------
//
// Single-shot tool observation: bind the selected tool schemas, call the model
// ONCE, and return the NATIVE LangChain AIMessage response unchanged. No loop,
// no feeding results back — we only observe the model's FIRST decision for the
// given messages + tools. The raw response (content, tool_calls, usage_metadata,
// response_metadata, …) is passed through verbatim so the UI can show the
// original LLM output. Mocked tool results are NOT part of the native response —
// they are derived separately (see getMockSteps) purely for the rendered view.
//
// toolNames: string[]   — which built-in tools to bind
// mocks: { [toolName]: string }  — optional mock output per tool (empty => auto)
// onStatus: (msg: string) => void  — live progress updates
//
// Returns the native AIMessage (serialized) plus a `mockSteps` helper array.
export async function runWithTools(messages, settings, params, toolNames, mocks, onStatus) {
  if (!settings?.api_key) {
    throw new Error('DeepSeek API key not set. Open Settings (gear icon) to configure it.')
  }
  const lcMessages = buildMessages(messages)
  if (lcMessages.length === 0) throw new Error('No non-empty messages to send.')

  const toolDefs = buildToolDefs(toolNames)
  if (toolDefs.length === 0) throw new Error('No tools selected.')

  let model
  try {
    model = createModel(settings, params)
  } catch (e) {
    throw new Error(`Failed to initialise model: ${e.message}`)
  }
  const bound = model.bindTools(toolDefs)

  // Call the model exactly once — observe its single-shot tool decision.
  onStatus?.('Model is thinking…')
  const ai = await bound.invoke(lcMessages)

  // Return the NATIVE, untransformed response. The UI decides how to render it.
  const native = ai.toJSON ? ai.toJSON() : JSON.parse(JSON.stringify(ai))
  native.kwargs = native.kwargs || {}
  if (ai.tool_calls) native.kwargs.tool_calls = ai.tool_calls
  if (ai.usage_metadata) native.kwargs.usage_metadata = ai.usage_metadata
  if (ai.response_metadata) native.kwargs.response_metadata = ai.response_metadata

  // Derive mocked tool results for the rendered trace view (not part of native output).
  const mockSteps = (ai.tool_calls || []).map((tc) => {
    const mock =
      mocks && mocks[tc.name] != null && mocks[tc.name] !== ''
        ? mocks[tc.name]
        : defaultMock(tc.name, tc.args)
    return {
      kind: 'tool',
      tool_call_id: tc.id,
      tool_name: tc.name,
      args: tc.args ?? {},
      content: mock,
    }
  })

  return { native, mockSteps }
}

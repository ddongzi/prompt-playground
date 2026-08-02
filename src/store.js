// Local-first JSONL storage backed by localStorage.
//
// Each entity (groups, prompts, runs) is stored as a JSONL string under a key
// (newline-delimited JSON, one record per line). Settings is a single JSON
// object. All CRUD is async-returning for a uniform interface.
//
// "Storage uses JSONL": the on-disk format you get via exportData() is real
// .jsonl files. importFile() reads them back. Local use only — the API key
// lives in localStorage alongside the data; that's fine for a local app.

const KEYS = {
  groups: 'pp.groups.jsonl',
  prompts: 'pp.prompts.jsonl',
  runs: 'pp.runs.jsonl',
  settings: 'pp.settings.json',
  tools: 'pp.tools.jsonl',
}

const DEFAULT_SETTINGS = {
  api_key: '',
  base_url: 'https://api.deepseek.com/v1',
  model: 'deepseek-chat',
  temperature: 0,
  max_tokens: 2048,
}

// ---------- low-level jsonl helpers ----------

function parseJsonl(text) {
  if (!text) return []
  const out = []
  for (const line of text.split('\n')) {
    const l = line.trim()
    if (!l) continue
    try {
      out.push(JSON.parse(l))
    } catch {
      // skip malformed line
    }
  }
  return out
}

function toJsonl(records) {
  if (!records.length) return ''
  return records.map((r) => JSON.stringify(r)).join('\n') + '\n'
}

function readJsonl(key) {
  return parseJsonl(localStorage.getItem(key) || '')
}

function writeJsonl(key, records) {
  localStorage.setItem(key, toJsonl(records))
}

function appendJsonl(key, record) {
  const all = readJsonl(key)
  all.push(record)
  writeJsonl(key, all)
}

function newId(prefix) {
  const rand = (
    (crypto?.randomUUID?.() || '') || Math.random().toString(36).slice(2)
  ).replace(/-/g, '').slice(0, 12)
  return `${prefix}_${rand}`
}

function now() {
  return new Date().toISOString()
}

// ---------- settings ----------

function readRawSettings() {
  try {
    return JSON.parse(localStorage.getItem(KEYS.settings) || '{}')
  } catch {
    return {}
  }
}

export function getSettings() {
  const merged = { ...DEFAULT_SETTINGS, ...readRawSettings() }
  const key = merged.api_key || ''
  const masked = key ? `${key.slice(0, 3)}***${key.slice(-4)}` : ''
  return { ...merged, has_api_key: !!key, api_key_masked: masked }
}

export async function saveSettings(payload) {
  const current = { ...DEFAULT_SETTINGS, ...readRawSettings() }
  for (const k of Object.keys(DEFAULT_SETTINGS)) {
    // An empty string means "keep existing" (not "clear").
    if (payload[k] !== undefined && payload[k] !== '') {
      current[k] = payload[k]
    }
  }
  const toWrite = {}
  for (const k of Object.keys(DEFAULT_SETTINGS)) toWrite[k] = current[k]
  localStorage.setItem(KEYS.settings, JSON.stringify(toWrite, null, 2))
  return getSettings()
}

// ---------- groups ----------

export async function listGroups() {
  return readJsonl(KEYS.groups).sort((a, b) =>
    (a.created_at || '').localeCompare(b.created_at || '')
  )
}

export async function createGroup(name, description = '') {
  const rec = {
    id: newId('grp'),
    name: (name || '').trim() || 'Untitled group',
    description: (description || '').trim(),
    created_at: now(),
  }
  appendJsonl(KEYS.groups, rec)
  return rec
}

export async function updateGroup(id, name, description = '') {
  const groups = readJsonl(KEYS.groups)
  let updated = null
  for (const g of groups) {
    if (g.id === id) {
      if (name !== undefined) g.name = (name || '').trim() || g.name
      if (description !== undefined) g.description = (description || '').trim()
      g.updated_at = now()
      updated = g
    }
  }
  writeJsonl(KEYS.groups, groups)
  return updated
}

export async function deleteGroup(id) {
  writeJsonl(KEYS.groups, readJsonl(KEYS.groups).filter((g) => g.id !== id))
  const prompts = readJsonl(KEYS.prompts)
  const removedPromptIds = new Set(
    prompts.filter((p) => p.group_id === id).map((p) => p.id)
  )
  writeJsonl(KEYS.prompts, prompts.filter((p) => p.group_id !== id))
  if (removedPromptIds.size) {
    writeJsonl(
      KEYS.runs,
      readJsonl(KEYS.runs).filter((r) => !removedPromptIds.has(r.prompt_id))
    )
  }
}

// ---------- prompts ----------

export async function listPrompts(groupId = null) {
  let prompts = readJsonl(KEYS.prompts)
  if (groupId) prompts = prompts.filter((p) => p.group_id === groupId)
  return prompts.sort((a, b) =>
    (b.updated_at || b.created_at || '').localeCompare(a.updated_at || a.created_at || '')
  )
}

export async function getPrompt(id) {
  return readJsonl(KEYS.prompts).find((p) => p.id === id) || null
}

export async function createPrompt({ group_id, name, messages, params, tools }) {
  const rec = {
    id: newId('pmt'),
    group_id,
    name: (name || '').trim() || 'Untitled prompt',
    messages: messages || [],
    params: params || {},
    tools: tools || { selected: [], mocks: {} },
    created_at: now(),
    updated_at: now(),
  }
  appendJsonl(KEYS.prompts, rec)
  return rec
}

export async function updatePrompt(id, { name, messages, params, tools }) {
  const prompts = readJsonl(KEYS.prompts)
  let updated = null
  for (const p of prompts) {
    if (p.id === id) {
      if (name !== undefined) p.name = (name || '').trim() || p.name
      if (messages !== undefined) p.messages = messages
      if (params !== undefined) p.params = params
      if (tools !== undefined) p.tools = tools
      p.updated_at = now()
      updated = p
    }
  }
  writeJsonl(KEYS.prompts, prompts)
  return updated
}

export async function deletePrompt(id) {
  writeJsonl(KEYS.prompts, readJsonl(KEYS.prompts).filter((p) => p.id !== id))
  writeJsonl(KEYS.runs, readJsonl(KEYS.runs).filter((r) => r.prompt_id !== id))
}

// ---------- runs ----------

export async function listRuns(promptId = null) {
  let runs = readJsonl(KEYS.runs)
  if (promptId) runs = runs.filter((r) => r.prompt_id === promptId)
  return runs.sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''))
}

export async function createRun(promptId, inputMessages, output, params, name) {
  const rec = {
    id: newId('run'),
    prompt_id: promptId,
    name: name || '',
    input_messages: inputMessages,
    output,
    params,
    feedback: { rating: null, comment: '', tags: [] },
    created_at: now(),
  }
  appendJsonl(KEYS.runs, rec)
  return rec
}

export async function renameRun(id, name) {
  const all = readJsonl(KEYS.runs)
  const idx = all.findIndex((r) => r.id === id)
  if (idx < 0) return null
  all[idx] = { ...all[idx], name }
  writeJsonl(KEYS.runs, all)
  return all[idx]
}

/* ----------- custom tools ----------- */
export function listCustomTools() {
  return readJsonl(KEYS.tools)
}

export function createCustomTool(tool) {
  const rec = {
    id: newId('custom_tool'),
    name: tool.name || '',
    description: tool.description || '',
    schema: tool.schema || {},
    mock_output: tool.mock_output || '',
    created_at: now(),
  }
  appendJsonl(KEYS.tools, rec)
  return rec
}

export function updateCustomTool(id, patch) {
  const all = readJsonl(KEYS.tools)
  const idx = all.findIndex((t) => t.id === id)
  if (idx < 0) return null
  all[idx] = { ...all[idx], ...patch }
  writeJsonl(KEYS.tools, all)
  return all[idx]
}

export function deleteCustomTool(id) {
  const all = readJsonl(KEYS.tools)
  const idx = all.findIndex((t) => t.id === id)
  if (idx < 0) return false
  all.splice(idx, 1)
  writeJsonl(KEYS.tools, all)
  return true
}

export async function updateRunFeedback(id, feedback) {
  const runs = readJsonl(KEYS.runs)
  let updated = null
  for (const r of runs) {
    if (r.id === id) {
      r.feedback = {
        rating: feedback.rating ?? null,
        comment: feedback.comment || '',
        tags: feedback.tags || [],
      }
      r.updated_at = now()
      updated = r
    }
  }
  writeJsonl(KEYS.runs, runs)
  return updated
}

export async function deleteRun(id) {
  writeJsonl(KEYS.runs, readJsonl(KEYS.runs).filter((r) => r.id !== id))
}

// ---------- export / import (real .jsonl files) ----------

export function exportData() {
  return [
    { filename: 'groups.jsonl', content: localStorage.getItem(KEYS.groups) || '' },
    { filename: 'prompts.jsonl', content: localStorage.getItem(KEYS.prompts) || '' },
    { filename: 'runs.jsonl', content: localStorage.getItem(KEYS.runs) || '' },
    { filename: 'settings.json', content: localStorage.getItem(KEYS.settings) || '{}' },
  ]
}

export function importFile(filename, text) {
  const lower = (filename || '').toLowerCase()
  if (lower.endsWith('groups.jsonl')) {
    localStorage.setItem(KEYS.groups, text)
    return 'groups'
  }
  if (lower.endsWith('prompts.jsonl')) {
    localStorage.setItem(KEYS.prompts, text)
    return 'prompts'
  }
  if (lower.endsWith('runs.jsonl')) {
    localStorage.setItem(KEYS.runs, text)
    return 'runs'
  }
  if (lower.endsWith('settings.json')) {
    localStorage.setItem(KEYS.settings, text)
    return 'settings'
  }
  return null
}

export function downloadText(filename, content) {
  const blob = new Blob([content], { type: 'application/octet-stream' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

// ---------- raw entity access (for the data manager UI) ----------
//
// The data manager lets you view & edit the raw JSONL/JSON of each entity
// directly. These helpers expose the underlying storage strings + validation.

export const ENTITIES = [
  { key: 'groups', file: 'groups.jsonl', label: 'Groups', kind: 'jsonl' },
  { key: 'prompts', file: 'prompts.jsonl', label: 'Prompts', kind: 'jsonl' },
  { key: 'runs', file: 'runs.jsonl', label: 'Runs', kind: 'jsonl' },
  { key: 'settings', file: 'settings.json', label: 'Settings', kind: 'json' },
  { key: 'tools', file: 'tools.jsonl', label: 'Tools', kind: 'jsonl' },
]

export function getEntityRaw(key) {
  return localStorage.getItem(KEYS[key]) ?? (key === 'settings' ? '{}' : '')
}

export function setEntityRaw(key, text) {
  localStorage.setItem(KEYS[key], text)
}

// returns null if valid, otherwise an error message describing the first bad line
export function validateEntity(key, text) {
  if (key === 'settings') {
    try {
      JSON.parse(text || '{}')
      return null
    } catch (e) {
      return `Invalid JSON: ${e.message}`
    }
  }
  const lines = (text || '').split('\n')
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i].trim()
    if (!l) continue
    try {
      JSON.parse(l)
    } catch (e) {
      return `Line ${i + 1}: ${e.message}`
    }
  }
  return null
}

// Return parsed records for the data manager card view.
export function readEntityRecords(key) {
  const storageKey = key === 'settings' ? KEYS.settings : KEYS[key]
  if (key === 'settings') {
    try {
      const raw = localStorage.getItem(storageKey) || '{}'
      return JSON.parse(raw)
    } catch {
      return {}
    }
  }
  return readJsonl(storageKey)
}

// Delete a single item by id from a JSONL entity.
export function deleteEntityItem(key, id) {
  const storageKey = KEYS[key]
  if (!storageKey) return false
  const all = readJsonl(storageKey)
  const idx = all.findIndex((r) => r.id === id)
  if (idx < 0) return false
  all.splice(idx, 1)
  writeJsonl(storageKey, all)
  return true
}

export function countEntity(key) {
  if (key === 'settings') return null
  return parseJsonl(localStorage.getItem(KEYS[key]) || '').length
}

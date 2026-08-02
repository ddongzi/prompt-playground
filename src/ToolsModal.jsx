import React, { useState, useMemo, useCallback } from 'react'
import {
  X, Wrench, Check, Search, Plus, Pencil, Trash2, AlertCircle,
  Download, Upload, FileCode,
} from 'lucide-react'
import { getAllTools } from './tools'
import { createCustomTool, updateCustomTool, deleteCustomTool, importTools, exportAllTools } from './store'
import SCAN_TOOLS_PY from './scan-tools-script'

const EMPTY_SCHEMA = JSON.stringify(
  {
    type: 'object',
    properties: { query: { type: 'string', description: 'Input parameter.' } },
    required: ['query'],
  },
  null,
  2
)

// Tools modal: pick which tools to bind for this prompt,
// optionally set mock output per tool, and manage tool definitions.
export default function ToolsModal({ isOpen, onClose, tools, onChange }) {
  const [query, setQuery] = useState('')
  const [version, setVersion] = useState(0)
  const [toast, setToast] = useState(null) // { text, type: 'success'|'error' }

  // Tool form
  const [editingId, setEditingId] = useState(null)
  const [formName, setFormName] = useState('')
  const [formDesc, setFormDesc] = useState('')
  const [formSchema, setFormSchema] = useState(EMPTY_SCHEMA)
  const [formMock, setFormMock] = useState('{"result":"ok"}')
  const [formError, setFormError] = useState('')

  const allTools = useMemo(() => getAllTools(), [version])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return allTools
    return allTools.filter(
      (t) =>
        (t.name || '').toLowerCase().includes(q) ||
        (t.description || '').toLowerCase().includes(q)
    )
  }, [query, allTools])

  const resetForm = () => {
    setEditingId(null)
    setFormName('')
    setFormDesc('')
    setFormSchema(EMPTY_SCHEMA)
    setFormMock('{"result":"ok"}')
    setFormError('')
  }

  const openEditForm = (t) => {
    setEditingId(t._id)
    setFormName(t.name)
    setFormDesc(t.description)
    setFormSchema(JSON.stringify(t.schema, null, 2))
    setFormMock(t.mock_output || '')
    setFormError('')
  }

  const saveTool = async () => {
    if (!formName.trim()) {
      setFormError('Tool name is required.')
      return
    }
    let schema
    try {
      schema = JSON.parse(formSchema)
    } catch {
      setFormError('Invalid JSON schema.')
      return
    }
    if (!schema || typeof schema !== 'object') {
      setFormError('Schema must be a JSON object.')
      return
    }

    try {
      if (editingId) {
        await updateCustomTool(editingId, {
          name: formName.trim(),
          description: formDesc.trim(),
          schema,
          mock_output: formMock,
        })
      } else {
        await createCustomTool({
          name: formName.trim(),
          description: formDesc.trim(),
          schema,
          mock_output: formMock,
        })
      }
      resetForm()
      setVersion((v) => v + 1)
    } catch (e) {
      setFormError(e.message)
    }
  }

  const removeTool = async (id, name) => {
    if (!window.confirm(`Delete tool "${name}"?`)) return
    await deleteCustomTool(id)
    if (editingId === id) resetForm()
    const sel = (tools?.selected || []).filter((n) => n !== name)
    onChange({ selected: sel, mocks: {} })
    setVersion((v) => v + 1)
  }

  const handleImport = useCallback(async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    try {
      const text = await file.text()
      const parsed = JSON.parse(text)
      const arr = Array.isArray(parsed) ? parsed : [parsed]
      await importTools(arr)
      setVersion((v) => v + 1)
      setToast({ text: `Imported ${arr.length} tool(s) successfully.`, type: 'success' })
      setTimeout(() => setToast(null), 2500)
    } catch (err) {
      setToast({ text: 'Invalid JSON file: ' + err.message, type: 'error' })
      setTimeout(() => setToast(null), 3000)
    }
    e.target.value = ''
  }, [])

  const handleExport = useCallback(() => {
    const data = exportAllTools()
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'tools.json'
    a.click()
    URL.revokeObjectURL(url)
  }, [])

  const handleDownloadScript = useCallback(async () => {
    const blob = new Blob([SCAN_TOOLS_PY], { type: 'text/x-python' })

    // Prefer File System Access API for "Save As" location picker
    if (window.showSaveFilePicker) {
      try {
        const handle = await window.showSaveFilePicker({
          suggestedName: 'scan_tools.py',
          types: [{ description: 'Python', accept: { 'text/x-python': ['.py'] } }],
        })
        const writable = await handle.createWritable()
        await writable.write(blob)
        await writable.close()
        setToast({ text: 'scan_tools.py saved.', type: 'success' })
        setTimeout(() => setToast(null), 2500)
        return
      } catch (err) {
        if (err.name === 'AbortError') return // user cancelled
        // fall through to fallback
      }
    }

    // Fallback: auto-download to browser default directory
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'scan_tools.py'
    a.click()
    URL.revokeObjectURL(url)
    setToast({ text: 'scan_tools.py downloaded.', type: 'success' })
    setTimeout(() => setToast(null), 2500)
  }, [])

  if (!isOpen) return null

  const selected = new Set(tools?.selected || [])

  const toggle = (name) => {
    const next = new Set(selected)
    if (next.has(name)) {
      next.delete(name)
    } else {
      next.add(name)
    }
    onChange({ selected: Array.from(next), mocks: {} })
  }

  const selectAll = () =>
    onChange({ selected: allTools.map((t) => t.name), mocks: {} })
  const clearAll = () => onChange({ selected: [], mocks: {} })

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-[2px] p-4">
      <div className="w-full max-w-5xl bg-[var(--bg-panel)] border border-[var(--border-color)] rounded-xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden relative">
        {/* Header */}
        <div className="px-5 py-3 border-b border-[var(--border-color)] flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <Wrench className="w-4 h-4 text-[var(--accent)]" />
            <h2 className="text-sm font-semibold text-[var(--text-main)]">Tools</h2>
            <span className="text-[10px] text-[var(--text-faint)]">
              bound via bindTools · execution mocked
            </span>
          </div>
          <button
            onClick={onClose}
            className="p-1 hover:bg-slate-100 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-main)] cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body: left list + right form */}
        <div className="flex-1 flex min-h-0 overflow-hidden">
          {/* Left: tool list */}
          <div className="w-1/2 border-r border-[var(--border-color)] flex flex-col min-w-0">
            {/* Search + bulk actions */}
            <div className="px-4 py-2 border-b border-[var(--border-color)] flex items-center gap-2 shrink-0">
              <div className="relative flex-1">
                <Search className="w-3.5 h-3.5 absolute left-2 top-1/2 -translate-y-1/2 text-[var(--text-faint)]" />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Filter tools…"
                  className="w-full pl-7 pr-2 py-1.5 text-xs bg-[var(--bg-input)] border border-[var(--border-color)] rounded focus:outline-none focus:border-[var(--accent)]"
                />
              </div>
              <span className="text-[11px] text-[var(--text-muted)] tabular-nums">
                {selected.size}/{allTools.length}
              </span>
              <button onClick={selectAll} className="btn btn-ghost text-[11px]">
                All
              </button>
              <button onClick={clearAll} className="btn btn-ghost text-[11px]">
                None
              </button>
            </div>

            {/* Tool list */}
            <div className="flex-1 overflow-y-auto">
              {filtered.map((t) => {
                const on = selected.has(t.name)
                return (
                  <div
                    key={t._id || t.name}
                    className={`border-b border-[var(--border-color)] ${on ? 'bg-[var(--accent-soft)]/40' : ''}`}
                  >
                    <div className="flex items-start gap-2 px-4 py-2">
                      <button
                        onClick={() => toggle(t.name)}
                        className={`mt-0.5 w-4 h-4 rounded border flex items-center justify-center shrink-0 cursor-pointer ${
                          on
                            ? 'bg-[var(--accent)] border-[var(--accent)] text-white'
                            : 'bg-white border-[var(--border-color)] hover:border-[var(--accent)]'
                        }`}
                      >
                        {on && <Check className="w-3 h-3" />}
                      </button>
                      <div className="flex-1 min-w-0">
                        <span className="text-xs font-mono font-semibold text-[var(--text-main)]">
                          {t.name || '(unnamed)'}
                        </span>
                        <p className="text-[11px] text-[var(--text-muted)] leading-snug mt-0.5 truncate">
                          {t.description || ''}
                        </p>
                      </div>
                      <div className="flex items-center gap-0.5 shrink-0">
                        <button
                          onClick={() => openEditForm(t)}
                          className="p-1 rounded text-[var(--text-muted)] hover:text-[var(--accent)] hover:bg-white cursor-pointer"
                          title="Edit tool"
                        >
                          <Pencil className="w-3 h-3" />
                        </button>
                        <button
                          onClick={() => removeTool(t._id, t.name)}
                          className="p-1 rounded text-[var(--text-muted)] hover:text-red-600 hover:bg-white cursor-pointer"
                          title="Delete tool"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  </div>
                )
              })}
              {filtered.length === 0 && (
                <div className="px-4 py-8 text-center text-xs text-[var(--text-faint)]">
                  No tools match "{query}".
                </div>
              )}
            </div>

            {/* Add tool button at bottom of list */}
            <div className="px-4 py-2 border-t border-[var(--border-color)] shrink-0">
              <button
                onClick={resetForm}
                className="w-full flex items-center justify-center gap-1.5 py-1.5 text-[11px] text-[var(--text-muted)] hover:text-[var(--accent)] hover:bg-white rounded-lg cursor-pointer border border-dashed border-[var(--border-color)]"
              >
                <Plus className="w-3.5 h-3.5" /> Add tool
              </button>
            </div>
          </div>

          {/* Right: add / edit form */}
          <div className="w-1/2 flex flex-col bg-[var(--bg-soft)]/50 min-w-0">
            <div className="px-4 py-2.5 border-b border-[var(--border-color)] flex items-center shrink-0">
              <span className="text-xs font-semibold text-[var(--text-main)]">
                {editingId ? 'Edit tool' : 'Add tool'}
              </span>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              <div>
                <label className="text-[10px] uppercase tracking-wider text-[var(--text-faint)] font-semibold">
                  Tool name
                </label>
                <input
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="e.g. my_search"
                  className="mt-0.5 w-full px-2 py-1.5 text-xs font-mono bg-white border border-[var(--border-color)] rounded focus:outline-none focus:border-[var(--accent)]"
                />
              </div>
              <div>
                <label className="text-[10px] uppercase tracking-wider text-[var(--text-faint)] font-semibold">
                  Description
                </label>
                <input
                  value={formDesc}
                  onChange={(e) => setFormDesc(e.target.value)}
                  placeholder="What this tool does"
                  className="mt-0.5 w-full px-2 py-1.5 text-xs bg-white border border-[var(--border-color)] rounded focus:outline-none focus:border-[var(--accent)]"
                />
              </div>
              <div>
                <label className="text-[10px] uppercase tracking-wider text-[var(--text-faint)] font-semibold">
                  Args JSON schema
                </label>
                <textarea
                  value={formSchema}
                  onChange={(e) => setFormSchema(e.target.value)}
                  spellCheck={false}
                  rows={6}
                  className="mt-0.5 w-full p-2 text-[11px] font-mono bg-white border border-[var(--border-color)] rounded focus:outline-none focus:border-[var(--accent)] resize-y"
                />
              </div>
              <div>
                <label className="text-[10px] uppercase tracking-wider text-[var(--text-faint)] font-semibold">
                  Default mock output
                </label>
                <textarea
                  value={formMock}
                  onChange={(e) => setFormMock(e.target.value)}
                  spellCheck={false}
                  rows={3}
                  placeholder='e.g. { "result": "ok" }'
                  className="mt-0.5 w-full p-2 text-[11px] font-mono bg-white border border-[var(--border-color)] rounded focus:outline-none focus:border-[var(--accent)] resize-y"
                />
              </div>
              {formError && (
                <div className="flex items-center gap-1.5 text-[11px] text-red-600">
                  <AlertCircle className="w-3.5 h-3.5" /> {formError}
                </div>
              )}
              <div className="flex items-center gap-2 pt-1">
                <button onClick={saveTool} className="btn btn-primary text-[11px]">
                  {editingId ? 'Update' : 'Add tool'}
                </button>
                {editingId != null && (
                  <button onClick={resetForm} className="btn btn-ghost text-[11px]">
                    Cancel
                  </button>
                )}
              </div>


            </div>
          </div>
        </div>

        {/* Toast */}
        {toast && (
          <div className={`absolute bottom-14 left-1/2 -translate-x-1/2 px-3 py-1.5 rounded text-[11px] shadow-lg transition-all
            ${toast.type === 'success' ? 'bg-green-700 text-white' : 'bg-red-700 text-white'}`}>
            {toast.text}
          </div>
        )}

        {/* Footer */}
        <div className="px-4 py-2.5 border-t border-[var(--border-color)] flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <span className="text-[10px] text-[var(--text-faint)]">
              {selected.size === 0
                ? 'No tools bound — plain chat run.'
                : `${selected.size} tool${selected.size === 1 ? '' : 's'} bound. Run prompt → single-shot observation.`}
            </span>
            <div className="h-3 w-px bg-[var(--border-color)]" />
            <label className="btn btn-ghost text-[11px] flex items-center gap-1 cursor-pointer">
              <Upload className="w-3 h-3" /> Import JSON
              <input
                type="file"
                accept=".json,.jsonl"
                onChange={handleImport}
                className="hidden"
              />
            </label>
            <button onClick={handleExport} className="btn btn-ghost text-[11px] flex items-center gap-1">
              <Download className="w-3 h-3" /> Export
            </button>
            <button onClick={handleDownloadScript} className="btn btn-ghost text-[11px] flex items-center gap-1">
              <FileCode className="w-3 h-3" /> scan_tools.py
            </button>
          </div>
          <button onClick={onClose} className="btn btn-primary">
            Done
          </button>
        </div>
      </div>
    </div>
  )
}

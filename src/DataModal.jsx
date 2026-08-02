import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import {
  X,
  Save,
  Database,
  AlertCircle,
  Check,
  RefreshCw,
  Trash2,
  ChevronRight,
  ChevronDown,
  FileJson,
  List,
  Search,
  Copy,
  Package,
  PackageOpen,
} from 'lucide-react'
import * as store from './store'

// ---------- helpers ----------

const niceDate = (iso) => {
  try {
    return new Date(iso).toLocaleString()
  } catch {
    return iso || ''
  }
}

const truncate = (s, n) => (s && s.length > n ? s.slice(0, n) + '…' : s)

// Field labels each entity tab shows in the card list.
const CARD_FIELDS = {
  groups: [
    { key: 'name', label: 'Name' },
    { key: 'system_prompt', label: 'System prompt', truncate: 50 },
    { key: 'created_at', label: 'Created', niceDate: true },
  ],
  prompts: [
    { key: 'name', label: 'Name' },
    { key: 'created_at', label: 'Created', niceDate: true },
  ],
  runs: [
    { key: 'name', label: 'Name' },
    { key: 'created_at', label: 'Created', niceDate: true },
  ],
}

// ---------- sub-components ----------

// A single record card in the list.
function RecordCard({ record, fields, isSelected, onClick, onDelete }) {
  const name = record.name || record.id
  return (
    <div
      onClick={onClick}
      className={`group flex items-start gap-2 px-3 py-2 cursor-pointer border-b border-[var(--border-color)] transition-colors ${
        isSelected
          ? 'bg-[var(--accent-soft)] border-l-[3px] border-l-[var(--accent)]'
          : 'hover:bg-slate-50 border-l-[3px] border-l-transparent'
      }`}
    >
      <div className="flex-1 min-w-0">
        <div className="text-xs font-medium text-[var(--text-main)] truncate">
          {name || '(unnamed)'}
        </div>
        <div className="mt-0.5 space-y-0.5">
          {fields
            .filter((f) => f.key !== 'name')
            .map((f) => {
              let val = record[f.key]
              if (val == null || val === '') return null
              if (f.niceDate) val = niceDate(val)
              if (f.truncate) val = truncate(String(val), f.truncate)
              return (
                <div key={f.key} className="flex gap-1.5 text-[10px]">
                  <span className="text-[var(--text-faint)] shrink-0">{f.label}:</span>
                  <span className="text-[var(--text-muted)] truncate">{String(val)}</span>
                </div>
              )
            })}
        </div>
      </div>
      <button
        onClick={(e) => {
          e.stopPropagation()
          onDelete(record.id)
        }}
        className="p-0.5 rounded opacity-0 group-hover:opacity-100 hover:bg-red-50 text-[var(--text-muted)] hover:text-red-600 cursor-pointer shrink-0"
        title="Delete record"
      >
        <Trash2 className="w-3 h-3" />
      </button>
    </div>
  )
}

// Expanded JSON view of a single record.
function ExpandedRecord({ record, onCopy, copied }) {
  const json = JSON.stringify(record, null, 2)
  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-between px-4 py-2 border-b border-[var(--border-color)] bg-[var(--bg-soft)] shrink-0">
        <span className="text-[11px] font-semibold text-[var(--text-muted)] uppercase tracking-wider flex items-center gap-1.5">
          <FileJson className="w-3.5 h-3.5" />
          {record.name || record.id || 'Record'}
        </span>
        <button
          onClick={() => {
            onCopy(json)
          }}
          className="p-1 rounded bg-white border border-[var(--border-color)] text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-slate-50 cursor-pointer"
          title="Copy JSON"
        >
          {copied ? <Check className="w-3 h-3 text-green-600" /> : <Copy className="w-3 h-3" />}
        </button>
      </div>
      <pre className="flex-1 min-h-0 overflow-auto p-4 text-[11px] font-mono leading-relaxed text-[var(--text-main)]">
        {json}
      </pre>
    </div>
  )
}

// Key-value table for settings entity.
function SettingsTable({ settings }) {
  return (
    <div className="p-3">
      <table className="w-full text-xs">
        <tbody>
          {Object.entries(settings || {}).map(([k, v]) => (
            <tr key={k} className="border-b border-[var(--border-color)] last:border-0">
              <td className="py-1.5 pr-3 font-mono text-[var(--text-main)] w-[180px] whitespace-nowrap">
                {k}
              </td>
              <td className="py-1.5 text-[var(--text-muted)] break-all">
                {k.toLowerCase().includes('key') && typeof v === 'string' && v.length > 8
                  ? v.slice(0, 4) + '••••' + v.slice(-4)
                  : String(v)}
                </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// Raw editor textarea (toggle mode).
function RawEditor({ text, onChange, placeholder, kind }) {
  return (
    <textarea
      value={text}
      onChange={(e) => onChange(e.target.value)}
      spellCheck={false}
      wrap="off"
      className="flex-1 min-h-0 w-full p-4 text-[11px] font-mono leading-relaxed bg-[var(--bg-soft)] text-[var(--text-main)] focus:outline-none resize-none"
      placeholder={
        kind === 'json'
          ? '{\n  "api_key": "sk-...",\n  "model": "deepseek-chat"\n}'
          : '{"id":"xxx","name":"...","created_at":"..."}\n'
      }
    />
  )
}

// ---------- main component ----------

export default function DataModal({ isOpen, onClose, onChanged }) {
  const [activeKey, setActiveKey] = useState('groups')
  const [text, setText] = useState('')
  const [dirty, setDirty] = useState(false)
  const [error, setError] = useState('')
  const [saved, setSaved] = useState(false)
  const [mode, setMode] = useState('cards') // 'cards' | 'raw'
  const [selectedId, setSelectedId] = useState(null)
  const [copied, setCopied] = useState(false)
  const [records, setRecords] = useState([])
  const [search, setSearch] = useState('')
  const importAllRef = useRef(null)
  const [bundleMsg, setBundleMsg] = useState('')

  const entity = useMemo(
    () => store.ENTITIES.find((e) => e.key === activeKey),
    [activeKey]
  )

  const counts = useMemo(
    () => ({
      groups: store.countEntity('groups'),
      prompts: store.countEntity('prompts'),
      runs: store.countEntity('runs'),
    }),
    [isOpen]
  )

  const load = useCallback(
    (key) => {
      const raw = store.getEntityRaw(key)
      setText(raw)
      setDirty(false)
      setError('')
      setSaved(false)
      try {
        setRecords(store.readEntityRecords(key))
      } catch {
        setRecords(key === 'settings' ? {} : [])
      }
      setSelectedId(null)
      setSearch('')
    },
    []
  )

  useEffect(() => {
    if (isOpen) load(activeKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, activeKey])

  const switchTab = (key) => {
    if (key === activeKey) return
    if (dirty && mode === 'raw' && !confirm('Discard unsaved changes in this tab?')) return
    setActiveKey(key)
    load(key)
  }

  const handleClose = () => {
    if (dirty && !confirm('Discard unsaved changes?')) return
    onClose()
  }

  const handleSave = () => {
    const err = store.validateEntity(activeKey, text)
    if (err) {
      setError(err)
      return
    }
    store.setEntityRaw(activeKey, text)
    setDirty(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 1500)
    if (activeKey === 'settings') {
      setRecords(JSON.parse(text || '{}'))
    } else {
      setRecords(
        (text || '')
          .split('\n')
          .filter(Boolean)
          .map((l) => JSON.parse(l))
      )
    }
    if (onChanged) onChanged()
  }

  const handleDelete = (id) => {
    if (!confirm('Delete this record? This cannot be undone.')) return
    store.deleteEntityItem(activeKey, id)
    // Rebuild raw text from in-memory records
    const nextRecords = (Array.isArray(records) ? records : []).filter((r) => r.id !== id)
    setRecords(nextRecords)
    const newText = nextRecords.length ? nextRecords.map((r) => JSON.stringify(r)).join('\n') + '\n' : ''
    setText(newText)
    store.setEntityRaw(activeKey, newText)
    if (selectedId === id) setSelectedId(null)
    if (onChanged) onChanged()
  }

  const handleCopy = async (str) => {
    try {
      await navigator.clipboard.writeText(str)
      setCopied(true)
      setTimeout(() => setCopied(false), 1200)
    } catch {}
  }

  const handleExportAll = () => {
    const bundle = store.exportAllBundled()
    const json = JSON.stringify(bundle, null, 2)
    store.downloadText('prompt-playground-backup.json', json)
  }

  const handleReload = () => {
    if (dirty && !confirm('Reload from storage and discard edits?')) return
    load(activeKey)
  }

  const handleImportAll = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    const t = await file.text()
    const result = store.importAllBundled(t)
    e.target.value = ''
    if (!result.ok) {
      setBundleMsg(`Import failed: ${result.error}`)
      setTimeout(() => setBundleMsg(''), 4000)
      return
    }
    const r = result.results
    const parts = []
    if (r.groups) parts.push(`${r.groups} groups`)
    if (r.prompts) parts.push(`${r.prompts} prompts`)
    if (r.runs) parts.push(`${r.runs} runs`)
    if (r.settings) parts.push('settings')
    if (r.tools) parts.push(`${r.tools} tools`)
    setBundleMsg(`Imported: ${parts.join(', ')}`)
    setTimeout(() => setBundleMsg(''), 4000)
    load(activeKey)
    if (onChanged) onChanged()
  }

  const handleTextChange = (v) => {
    setText(v)
    setDirty(true)
    setSaved(false)
    setError('')
  }

  const byteSize = new Blob([text]).size

  // Filter logic
  const filteredRecords = useMemo(() => {
    const arr = Array.isArray(records) ? records : []
    if (!search.trim()) return arr
    const q = search.toLowerCase()
    return arr.filter((r) => JSON.stringify(r).toLowerCase().includes(q))
  }, [records, search])

  const selectedRecord = useMemo(() => {
    if (!selectedId) return null
    const arr = Array.isArray(records) ? records : []
    return arr.find((r) => r.id === selectedId) || null
  }, [records, selectedId])

  const fields = CARD_FIELDS[activeKey] || []

  if (!isOpen) return null

  const isSettings = activeKey === 'settings'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-[2px] p-4">
      <div className="w-[960px] h-[700px] bg-[var(--bg-panel)] border border-[var(--border-color)] rounded-xl shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-5 py-3 border-b border-[var(--border-color)] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Database className="w-4 h-4 text-[var(--accent)]" />
            <h2 className="text-sm font-semibold text-[var(--text-main)]">Data manager</h2>
            <span className="text-[10px] text-[var(--text-faint)]">localStorage</span>
          </div>
          <button
            onClick={handleClose}
            className="p-1 hover:bg-slate-100 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-main)] cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tabs + mode toggle */}
        <div className="flex items-center justify-between border-b border-[var(--border-color)] bg-[var(--bg-soft)]">
          <div className="flex">
            {store.ENTITIES.map((e) => {
              const active = e.key === activeKey
              const count = counts[e.key]
              return (
                <button
                  key={e.key}
                  onClick={() => switchTab(e.key)}
                  className={`px-4 py-2 text-xs font-medium border-b-2 transition-colors cursor-pointer ${
                    active
                      ? 'border-[var(--accent)] text-[var(--accent)] bg-[var(--bg-panel)]'
                      : 'border-transparent text-[var(--text-muted)] hover:text-[var(--text-main)]'
                  }`}
                >
                  {e.label}
                  {count != null && (
                    <span className="ml-1.5 text-[10px] tabular-nums opacity-70">{count}</span>
                  )}
                </button>
              )
            })}
          </div>
          <div className="flex items-center gap-0.5 p-1 mr-2 rounded-md bg-[var(--bg-panel)] border border-[var(--border-color)]">
            <button
              onClick={() => { setMode('cards'); setDirty(false); setError('') }}
              className={`px-2 py-0.5 rounded text-[11px] font-medium cursor-pointer flex items-center gap-1 ${
                mode === 'cards'
                  ? 'bg-white text-[var(--text-main)] shadow-sm'
                  : 'text-[var(--text-muted)] hover:text-[var(--text-main)]'
              }`}
            >
              <List className="w-3 h-3" /> Cards
            </button>
            <button
              onClick={() => { setMode('raw'); setSelectedId(null) }}
              className={`px-2 py-0.5 rounded text-[11px] font-medium cursor-pointer flex items-center gap-1 ${
                mode === 'raw'
                  ? 'bg-white text-[var(--text-main)] shadow-sm'
                  : 'text-[var(--text-muted)] hover:text-[var(--text-main)]'
              }`}
            >
              <FileJson className="w-3 h-3" /> Raw
            </button>
          </div>
        </div>

        {/* Toolbar */}
        <div className="flex items-center gap-2 px-4 py-2 border-b border-[var(--border-color)] flex-wrap">
          <span className="text-[11px] font-mono text-[var(--text-muted)]">{entity.file}</span>
          <span className="text-[10px] text-[var(--text-faint)] uppercase">{entity.kind}</span>
          <span className="text-[10px] text-[var(--text-faint)] tabular-nums">
            {byteSize.toLocaleString()} B
          </span>
          {dirty && mode === 'raw' && (
            <span className="text-[10px] text-amber-700 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded">
              unsaved
            </span>
          )}
          {saved && !dirty && (
            <span className="text-[10px] text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded flex items-center gap-1">
              <Check className="w-3 h-3" /> saved
            </span>
          )}
          <div className="ml-auto flex items-center gap-1.5">
            <button onClick={handleReload} className="btn btn-ghost" title="Reload from storage">
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
            {mode === 'raw' && (
              <button onClick={handleSave} disabled={!dirty} className="btn btn-primary">
                <Save className="w-3.5 h-3.5" /> Save
              </button>
            )}
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="px-4 py-1.5 bg-red-50 text-red-700 text-[11px] border-b border-red-200 flex items-center gap-1.5">
            <AlertCircle className="w-3.5 h-3.5 shrink-0" />
            <span className="font-mono">{error}</span>
          </div>
        )}

        {/* Body */}
        {mode === 'raw' ? (
          <RawEditor
            text={text}
            onChange={handleTextChange}
            kind={entity.kind}
          />
        ) : isSettings ? (
          <div className="flex-1 min-h-0 overflow-auto">
            <SettingsTable settings={records} />
          </div>
        ) : (
          <div className="flex-1 min-h-0 flex">
            {/* Left: record list */}
            <div className="w-[280px] shrink-0 border-r border-[var(--border-color)] flex flex-col min-h-0">
              {/* Search */}
              <div className="p-2 border-b border-[var(--border-color)]">
                <div className="relative">
                  <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-[var(--text-faint)]" />
                  <input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search…"
                    className="w-full pl-6.5 pr-2 py-1 text-[11px] border border-[var(--border-color)] rounded bg-white text-[var(--text-main)] placeholder:text-[var(--text-faint)] outline-none focus:border-[var(--accent)]"
                  />
                </div>
              </div>
              {/* List */}
              <div className="flex-1 overflow-auto">
                {filteredRecords.length === 0 ? (
                  <div className="px-4 py-8 text-center text-[11px] text-[var(--text-faint)]">
                    {search ? 'No matching records.' : 'No records yet.'}
                  </div>
                ) : (
                  filteredRecords.map((r) => (
                    <RecordCard
                      key={r.id}
                      record={r}
                      fields={fields}
                      isSelected={r.id === selectedId}
                      onClick={() =>
                        setSelectedId((prev) => (prev === r.id ? null : r.id))
                      }
                      onDelete={handleDelete}
                    />
                  ))
                )}
              </div>
            </div>
            {/* Right: detail */}
            <div className="flex-1 min-w-0 min-h-0 flex flex-col">
              {selectedRecord ? (
                <ExpandedRecord record={selectedRecord} onCopy={handleCopy} copied={copied} />
              ) : (
                <div className="flex-1 flex items-center justify-center text-[var(--text-faint)] text-xs">
                  Select a record from the left to view details
                </div>
              )}
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="px-4 py-2.5 border-t border-[var(--border-color)] flex items-center justify-between gap-2">
          <span className="text-[10px] text-[var(--text-faint)]">
            {bundleMsg ? (
              <span className={bundleMsg.startsWith('Import failed') ? 'text-red-600' : 'text-emerald-600'}>
                {bundleMsg}
              </span>
            ) : mode === 'cards'
              ? 'Click a record to expand its JSON. Delete removes it permanently.'
              : 'Raw editor — validate, then save to persist.'}
          </span>
          <div className="flex gap-2">
            <button onClick={() => importAllRef.current?.click()} className="btn btn-outline">
              <PackageOpen className="w-3.5 h-3.5" /> Import all
            </button>
            <button onClick={handleExportAll} className="btn btn-outline">
              <Package className="w-3.5 h-3.5" /> Export all
            </button>
            <button onClick={handleClose} className="btn btn-outline">
              Close
            </button>
          </div>
          <input
            ref={importAllRef}
            type="file"
            accept=".json"
            onChange={handleImportAll}
            className="hidden"
          />
        </div>
      </div>
    </div>
  )
}

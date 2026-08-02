import React, { useState } from 'react'
import {
  Send,
  Loader2,
  Plus,
  Trash2,
  Save,
  Bot,
  User,
  Cpu,
  Wrench,
  Upload,
} from 'lucide-react'
import ImportMessagesModal from './ImportMessagesModal'
import ToolsModal from './ToolsModal'

// LangChain message types supported by the backend.
const MESSAGE_TYPES = [
  { type: 'system', label: 'System', icon: Cpu, cls: 'violet' },
  { type: 'human', label: 'Human', icon: User, cls: 'emerald' },
  { type: 'ai', label: 'AI', icon: Bot, cls: 'sky' },
  { type: 'tool', label: 'Tool', icon: Wrench, cls: 'amber' },
]

const TYPE_STYLES = {
  violet: { chip: 'bg-violet-100 text-violet-700 border-violet-200', ring: 'focus:border-violet-400' },
  emerald: { chip: 'bg-emerald-100 text-emerald-700 border-emerald-200', ring: 'focus:border-emerald-400' },
  sky: { chip: 'bg-sky-100 text-sky-700 border-sky-200', ring: 'focus:border-sky-400' },
  amber: { chip: 'bg-amber-100 text-amber-700 border-amber-200', ring: 'focus:border-amber-400' },
}

function MessageRow({ msg, index, onChange, onDelete }) {
  const meta = MESSAGE_TYPES.find((m) => m.type === msg.type) || MESSAGE_TYPES[1]
  const Icon = meta.icon
  const style = TYPE_STYLES[meta.cls]
  const isTool = msg.type === 'tool'

  return (
    <div className={`rounded-lg border ${style.chip} border bg-white/60 overflow-hidden`}>
      <div className="flex items-center gap-1.5 px-2 py-1 bg-white/70 border-b border-[var(--border-color)]">
        <Icon className="w-3.5 h-3.5 shrink-0" />
        <span className="text-[11px] font-semibold uppercase tracking-wide">{meta.label}</span>
        <span className="text-[10px] text-[var(--text-faint)] tabular-nums">#{index + 1}</span>
        <div className="ml-auto flex items-center gap-0.5">
          {MESSAGE_TYPES.map((t) => (
            <button
              key={t.type}
              onClick={() => onChange(index, { ...msg, type: t.type })}
              className={`text-[10px] px-1.5 py-0.5 rounded border cursor-pointer transition-colors ${
                msg.type === t.type
                  ? TYPE_STYLES[t.cls].chip
                  : 'border-transparent text-[var(--text-muted)] hover:bg-slate-100'
              }`}
              title={`Switch to ${t.label}`}
            >
              {t.label}
            </button>
          ))}
          <button
            onClick={() => onDelete(index)}
            className="ml-1 p-0.5 text-[var(--text-muted)] hover:text-red-600 cursor-pointer"
            title="Remove message"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
      <textarea
        value={msg.data?.content || ''}
        onChange={(e) => onChange(index, { ...msg, data: { ...msg.data, content: e.target.value } })}
        placeholder={`Enter ${meta.label.toLowerCase()} message content...`}
        rows={Math.min(8, Math.max(2, (msg.data?.content || '').split('\n').length + 1))}
        className={`w-full px-2.5 py-2 text-xs font-mono leading-relaxed text-[var(--text-main)] bg-transparent focus:outline-none ${style.ring} resize-y border-0`}
      />
      {isTool && (
        <div className="px-2.5 pb-2 bg-white/70 border-t border-[var(--border-color)] space-y-1.5">
          <div>
            <label className="block text-[10px] text-[var(--text-muted)] mt-1.5 mb-0.5 font-medium">
              name
            </label>
            <input
              value={msg.data?.name || ''}
              onChange={(e) => onChange(index, { ...msg, data: { ...msg.data, name: e.target.value } })}
              placeholder="tool name"
              className="w-full bg-white border border-[var(--border-color)] rounded px-2 py-1 text-[11px] font-mono focus:outline-none focus:border-amber-400"
            />
          </div>
          <div>
            <label className="block text-[10px] text-[var(--text-muted)] mb-0.5 font-medium">
              tool_call_id
            </label>
            <input
              value={msg.data?.tool_call_id || ''}
              onChange={(e) => onChange(index, { ...msg, data: { ...msg.data, tool_call_id: e.target.value } })}
              placeholder="tool_call_id (required for ToolMessage)"
              className="w-full bg-white border border-[var(--border-color)] rounded px-2 py-1 text-[11px] font-mono focus:outline-none focus:border-amber-400"
            />
          </div>
        </div>
      )}
      {msg.type === 'ai' && msg.data?.tool_calls?.length > 0 && (
        <div className="px-2.5 pb-2 bg-white/70 border-t border-[var(--border-color)]">
          <div className="text-[10px] text-[var(--text-muted)] mt-1.5 mb-1 font-medium uppercase tracking-wide">
            Tool calls ({msg.data.tool_calls.length})
          </div>
          <div className="space-y-1">
            {msg.data.tool_calls.map((tc, i) => (
              <div
                key={i}
                className="text-[11px] font-mono bg-amber-50/60 border border-amber-200 rounded px-2 py-1"
              >
                <div className="flex items-center gap-2">
                  <span className="text-amber-800 font-semibold">→ {tc.name || '(unnamed)'}</span>
                  {tc.id && (
                    <span className="text-[var(--text-faint)] text-[10px]">id: {tc.id}</span>
                  )}
                </div>
                <pre className="mt-0.5 text-[10px] text-[var(--text-muted)] whitespace-pre-wrap break-all m-0">
                  {JSON.stringify(tc.args ?? {}, null, 2)}
                </pre>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

export default function MessageEditor({
  promptName,
  setPromptName,
  messages,
  setMessages,
  onSend,
  loading,
  hasApiKey,
  hasPrompt,
  dirty,
  onSave,
  promptTools,
  setPromptTools,
}) {
  const update = (i, msg) => setMessages(messages.map((m, idx) => (idx === i ? msg : m)))
  const remove = (i) => setMessages(messages.filter((_, idx) => idx !== i))
  const add = (type) => setMessages([...messages, { type, data: { content: '' } }])

  const [importOpen, setImportOpen] = useState(false)
  const [toolsOpen, setToolsOpen] = useState(false)
  const toolCount = (promptTools?.selected || []).length

  const canSend =
    !loading &&
    hasApiKey &&
    messages.some((m) => (m.data?.content || '').trim().length > 0)

  return (
    <section className="flex-1 flex flex-col min-w-0 min-h-0 bg-[var(--bg-main)]">
      {/* Top bar: prompt name + actions */}
      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-[var(--border-color)] bg-[var(--bg-panel)] shrink-0">
        <input
          value={promptName}
          onChange={(e) => setPromptName(e.target.value)}
          placeholder="Prompt name..."
          className="flex-1 min-w-0 bg-transparent text-sm font-semibold text-[var(--text-main)] focus:outline-none placeholder:text-[var(--text-faint)]"
        />
        {dirty && (
          <span className="text-[10px] text-amber-600 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded">
            unsaved
          </span>
        )}
        <button
          onClick={onSave}
          disabled={!hasPrompt && !promptName.trim()}
          className="btn btn-outline"
          title={hasPrompt ? 'Save changes' : 'Save as new prompt'}
        >
          <Save className="w-3.5 h-3.5" /> {hasPrompt ? 'Save' : 'Save as'}
        </button>
      </div>

      {/* Messages list */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3 min-h-0">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center text-[var(--text-faint)] gap-2">
            <Bot className="w-10 h-10 opacity-30" />
            <div className="text-sm">No messages yet.</div>
            <div className="text-xs">Add a message below to compose your prompt as LangChain Messages.</div>
          </div>
        ) : (
          messages.map((m, i) => (
            <MessageRow key={i} msg={m} index={i} onChange={update} onDelete={remove} />
          ))
        )}
      </div>

      {/* Add-message toolbar */}
      <div className="px-4 py-2 border-t border-[var(--border-color)] bg-[var(--bg-panel)] shrink-0 flex items-center gap-1.5 flex-wrap">
        <span className="text-[11px] text-[var(--text-muted)] mr-1 flex items-center gap-1">
          <Plus className="w-3.5 h-3.5" /> Add message:
        </span>
        {MESSAGE_TYPES.map((t) => {
          const Icon = t.icon
          return (
            <button
              key={t.type}
              onClick={() => add(t.type)}
              className="btn btn-ghost border border-[var(--border-color)] bg-white"
            >
              <Icon className="w-3.5 h-3.5" /> {t.label}
            </button>
          )
        })}
        <button
          onClick={() => setImportOpen(true)}
          className="btn btn-outline ml-auto"
          title="Import a message list exported from Python LangChain"
        >
          <Upload className="w-3.5 h-3.5" /> Import
        </button>
      </div>

      {/* Send bar */}
      <div className="px-4 py-2.5 border-t border-[var(--border-color)] bg-[var(--bg-panel)] shrink-0">
        <div className="flex items-center justify-end gap-2">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setToolsOpen(true)}
              className={toolCount > 0 ? 'btn btn-primary' : 'btn btn-outline'}
              title="Select tools to bind (agent loop with mocked execution)"
            >
              <Wrench className="w-3.5 h-3.5" /> Tools
              {toolCount > 0 && (
                <span className="ml-0.5 text-[10px] tabular-nums bg-white/25 rounded px-1">
                  {toolCount}
                </span>
              )}
            </button>
            <button
              onClick={onSend}
              disabled={!canSend}
              className="btn btn-primary"
            >
              {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
              {loading ? 'Generating...' : 'Run prompt'}
            </button>
          </div>
        </div>
      </div>

      <ToolsModal
        isOpen={toolsOpen}
        onClose={() => setToolsOpen(false)}
        tools={promptTools || { selected: [], mocks: {} }}
        onChange={setPromptTools}
      />

      <ImportMessagesModal
        isOpen={importOpen}
        onClose={() => setImportOpen(false)}
        onImport={(msgs) => setMessages(msgs)}
      />
    </section>
  )
}

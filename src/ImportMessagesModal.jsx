import React, { useState, useMemo, useEffect } from 'react'
import { X, Upload, AlertCircle, ClipboardPaste } from 'lucide-react'
import { parseImportedMessages } from './messages'

const TYPE_LABEL = { system: 'System', human: 'Human', ai: 'AI', tool: 'Tool' }

export default function ImportMessagesModal({ isOpen, onClose, onImport }) {
  const [text, setText] = useState('')
  const parsed = useMemo(() => parseImportedMessages(text), [text])

  useEffect(() => {
    if (isOpen) setText('')
  }, [isOpen])

  if (!isOpen) return null

  const handleReplace = () => {
    if (!parsed.ok) return
    onImport(parsed.messages)
    onClose()
  }

  const handlePaste = async () => {
    try {
      const t = await navigator.clipboard.readText()
      if (t) setText(t)
    } catch {
      /* clipboard blocked — user can paste manually */
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-[2px] p-4">
      <div className="w-full max-w-2xl bg-[var(--bg-panel)] border border-[var(--border-color)] rounded-xl shadow-2xl flex flex-col max-h-[85vh] overflow-hidden">
        {/* Header */}
        <div className="px-5 py-3 border-b border-[var(--border-color)] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Upload className="w-4 h-4 text-[var(--accent)]" />
            <h2 className="text-sm font-semibold text-[var(--text-main)]">Import messages</h2>
            <span className="text-[10px] text-[var(--text-faint)]">from Python LangChain</span>
          </div>
          <button
            onClick={onClose}
            className="p-1 hover:bg-slate-100 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-main)] cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 min-h-0 flex flex-col p-4 gap-3 overflow-hidden">
          <div className="flex items-center justify-between">
            <p className="text-[11px] text-[var(--text-muted)] leading-relaxed">
              Paste a JSON message list exported from Python. Accepted:{' '}
              <code className="font-mono text-[10px]">[m.model_dump() for m in msgs]</code>,{' '}
              <code className="font-mono text-[10px]">messages_to_json(msgs)</code>, or OpenAI{' '}
              <code className="font-mono text-[10px]">role/content</code> style. This{' '}
              <b>replaces</b> the current messages.
            </p>
            <button onClick={handlePaste} className="btn btn-ghost shrink-0" title="Paste from clipboard">
              <ClipboardPaste className="w-3.5 h-3.5" /> Paste
            </button>
          </div>

          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            spellCheck={false}
            wrap="off"
            placeholder={`[
  {"type": "system", "content": "You are a helpful assistant."},
  {"type": "human", "content": "Hello"}
]`}
            className="flex-1 min-h-[180px] w-full p-3 text-[11px] font-mono leading-relaxed bg-[var(--bg-soft)] border border-[var(--border-color)] rounded-lg text-[var(--text-main)] focus:outline-none focus:border-[var(--accent)] resize-none"
          />

          {/* Status / preview */}
          {text.trim() === '' ? null : parsed.ok ? (
            <div className="text-[11px] text-emerald-700 bg-emerald-50 border border-emerald-200 rounded px-2.5 py-1.5">
              <b>OK</b> — {parsed.messages.length} message{parsed.messages.length === 1 ? '' : 's'}:{' '}
              {parsed.messages
                .map((m) => `${TYPE_LABEL[m.type] || m.type}(${m.content.length})`)
                .join(' → ')}
            </div>
          ) : (
            <div className="text-[11px] text-red-700 bg-red-50 border border-red-200 rounded px-2.5 py-1.5 flex items-center gap-1.5">
              <AlertCircle className="w-3.5 h-3.5 shrink-0" />
              <span className="font-mono">{parsed.error}</span>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-4 py-2.5 border-t border-[var(--border-color)] flex justify-end gap-2">
          <button onClick={onClose} className="btn btn-outline">
            Cancel
          </button>
          <button onClick={handleReplace} disabled={!parsed.ok} className="btn btn-primary">
            <Upload className="w-3.5 h-3.5" /> Replace messages
          </button>
        </div>
      </div>
    </div>
  )
}

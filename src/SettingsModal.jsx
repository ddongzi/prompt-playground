import React, { useState, useEffect } from 'react'
import {
  X,
  Save,
  KeyRound,
  Server,
  Bot,
  SlidersHorizontal,
  Eye,
  EyeOff,
} from 'lucide-react'

export default function SettingsModal({ isOpen, onClose, settings, onSave }) {
  const [form, setForm] = useState({
    api_key: '',
    base_url: 'https://api.deepseek.com/v1',
    model: 'deepseek-chat',
    temperature: 0,
    max_tokens: 2048,
  })
  const [showKey, setShowKey] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (isOpen && settings) {
      setForm({
        api_key: '', // always blank; sending blank means "keep existing"
        base_url: settings.base_url ?? 'https://api.deepseek.com/v1',
        model: settings.model ?? 'deepseek-chat',
        temperature: settings.temperature ?? 0,
        max_tokens: settings.max_tokens ?? 2048,
      })
      setError('')
    }
  }, [isOpen, settings])

  if (!isOpen) return null

  const handle = (k, v) => setForm((f) => ({ ...f, [k]: v }))

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSaving(true)
    setError('')
    try {
      const payload = { ...form }
      if (!payload.api_key) delete payload.api_key
      await onSave(payload)
      onClose()
    } catch (err) {
      setError(err.message || 'Failed to save settings')
    } finally {
      setSaving(false)
    }
  }

  const masked = settings?.api_key_masked || ''
  const hasKey = settings?.has_api_key

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-[2px] p-4">
      <div className="w-full max-w-lg bg-[var(--bg-panel)] border border-[var(--border-color)] rounded-xl shadow-2xl flex flex-col max-h-[88vh] overflow-hidden">
        {/* Header */}
        <div className="px-5 py-3.5 border-b border-[var(--border-color)] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Bot className="w-4 h-4 text-[var(--accent)]" />
            <h2 className="text-sm font-semibold text-[var(--text-main)]">Settings</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 hover:bg-slate-100 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-main)] cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-5 space-y-5 text-xs">
          {/* API key */}
          <div className="space-y-2">
            <label className="flex items-center gap-1.5 font-semibold text-[var(--text-main)]">
              <KeyRound className="w-3.5 h-3.5 text-[var(--accent)]" /> DeepSeek API Key
            </label>
            {hasKey && (
              <div className="text-[11px] text-[var(--text-muted)] bg-emerald-50 border border-emerald-200 rounded px-2 py-1.5">
                Current key: <span className="font-mono">{masked}</span> — leave the field below blank to keep it.
              </div>
            )}
            <div className="relative">
              <input
                type={showKey ? 'text' : 'password'}
                value={form.api_key}
                onChange={(e) => handle('api_key', e.target.value)}
                placeholder="sk-..."
                className="w-full bg-[var(--bg-input)] border border-[var(--border-color)] rounded px-2.5 py-2 pr-9 font-mono focus:outline-none focus:border-[var(--accent)]"
              />
              <button
                type="button"
                onClick={() => setShowKey((s) => !s)}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-[var(--text-muted)] hover:text-[var(--text-main)] cursor-pointer"
              >
                {showKey ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              </button>
            </div>
            <p className="text-[10px] text-[var(--text-faint)]">
              Stored in your browser's localStorage. Get one at{' '}
              <a
                href="https://platform.deepseek.com/api_keys"
                target="_blank"
                rel="noreferrer"
                className="text-[var(--accent)] underline"
              >
                platform.deepseek.com
              </a>
              .
            </p>
          </div>

          {/* Base URL + model */}
          <div className="space-y-2">
            <label className="flex items-center gap-1.5 font-semibold text-[var(--text-main)]">
              <Server className="w-3.5 h-3.5 text-[var(--accent)]" /> Endpoint &amp; Model
            </label>
            <div className="grid grid-cols-1 gap-2">
              <input
                value={form.base_url}
                onChange={(e) => handle('base_url', e.target.value)}
                placeholder="https://api.deepseek.com/v1"
                className="w-full bg-[var(--bg-input)] border border-[var(--border-color)] rounded px-2.5 py-2 font-mono focus:outline-none focus:border-[var(--accent)]"
              />
              <input
                value={form.model}
                onChange={(e) => handle('model', e.target.value)}
                placeholder="deepseek-chat"
                className="w-full bg-[var(--bg-input)] border border-[var(--border-color)] rounded px-2.5 py-2 font-mono focus:outline-none focus:border-[var(--accent)]"
              />
            </div>
            <p className="text-[10px] text-[var(--text-faint)]">
              DeepSeek models: <span className="font-mono">deepseek-chat</span>,{' '}
              <span className="font-mono">deepseek-reasoner</span>.
            </p>
          </div>

          {/* Default params */}
          <div className="space-y-2">
            <label className="flex items-center gap-1.5 font-semibold text-[var(--text-main)]">
              <SlidersHorizontal className="w-3.5 h-3.5 text-[var(--accent)]" /> Default params
            </label>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] text-[var(--text-muted)] mb-1">Temperature</label>
                <input
                  type="number"
                  min="0"
                  max="2"
                  step="0.05"
                  value={form.temperature}
                  onChange={(e) => handle('temperature', parseFloat(e.target.value))}
                  className="w-full bg-[var(--bg-input)] border border-[var(--border-color)] rounded px-2 py-1.5 font-mono focus:outline-none focus:border-[var(--accent)]"
                />
              </div>
              <div>
                <label className="block text-[11px] text-[var(--text-muted)] mb-1">Max tokens</label>
                <input
                  type="number"
                  min="256"
                  max="32768"
                  step="256"
                  value={form.max_tokens}
                  onChange={(e) => handle('max_tokens', parseInt(e.target.value, 10))}
                  className="w-full bg-[var(--bg-input)] border border-[var(--border-color)] rounded px-2 py-1.5 font-mono focus:outline-none focus:border-[var(--accent)]"
                />
              </div>
            </div>
          </div>

          {error && (
            <div className="text-[11px] text-red-700 bg-red-50 border border-red-200 rounded px-2 py-1.5">
              {error}
            </div>
          )}

          <div className="pt-1 flex justify-end gap-2">
            <button type="button" onClick={onClose} className="btn btn-outline">
              Cancel
            </button>
            <button type="submit" disabled={saving} className="btn btn-primary">
              <Save className="w-3.5 h-3.5" /> {saving ? 'Saving...' : 'Save settings'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

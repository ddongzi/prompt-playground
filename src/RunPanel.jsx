import React, { useEffect, useState } from 'react'
import {
  Loader2,
  AlertCircle,
  Terminal,
  Cpu,
  Star,
  MessageSquare,
  Tag,
  X,
  Plus,
  Copy,
  Check,
} from 'lucide-react'

function formatTokens(usage) {
  if (!usage) return null
  const inTok = usage.input_tokens ?? usage.prompt_tokens
  const outTok = usage.output_tokens ?? usage.completion_tokens
  const total = usage.total_tokens ?? (inTok && outTok ? inTok + outTok : null)
  const parts = []
  if (inTok != null) parts.push(`in ${inTok}`)
  if (outTok != null) parts.push(`out ${outTok}`)
  if (total != null) parts.push(`total ${total}`)
  return parts.join(' · ')
}

// Simple tool-calls list: just name + args, displayed inline below the text output.
function ToolCallsList({ toolCalls }) {
  return (
    <div className="mt-3 space-y-1.5">
      <span className="text-[10px] font-semibold text-[var(--text-muted)] uppercase tracking-wider">
        Tool calls ({toolCalls.length})
      </span>
      {toolCalls.map((tc, i) => (
        <div key={i} className="text-[11px] font-mono bg-amber-50 border border-amber-200 rounded p-2">
          <span className="text-amber-700 font-semibold">{tc.name}</span>
          <pre className="mt-1 whitespace-pre-wrap break-words text-[var(--text-muted)]">
            {JSON.stringify(tc.args, null, 2)}
          </pre>
        </div>
      ))}
    </div>
  )
}

// Raw JSON view of the original run output object — the unrendered source.
function RawView({ output }) {
  const text = JSON.stringify(output, null, 2)
  return (
    <div className="space-y-2">
      <span className="text-[11px] font-semibold text-[var(--text-muted)] uppercase tracking-wider flex items-center gap-1.5">
        <Terminal className="w-3.5 h-3.5" /> Raw output (original)
      </span>
      <pre className="text-xs font-mono whitespace-pre-wrap break-words text-[var(--text-main)] leading-relaxed rounded-lg border border-[var(--border-color)] bg-[var(--bg-soft)] p-3 min-h-[140px]">
        {text}
      </pre>
    </div>
  )
}

function Stars({ value, onChange }) {
  const [hover, setHover] = useState(0)
  const v = hover || value || 0
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          onMouseEnter={() => setHover(n)}
          onMouseLeave={() => setHover(0)}
          onClick={() => onChange(value === n ? null : n)}
          className="p-0.5 cursor-pointer"
          title={`${n} star${n > 1 ? 's' : ''}`}
        >
          <Star
            className={`w-4 h-4 ${
              n <= v ? 'fill-amber-400 text-amber-400' : 'text-slate-300 hover:text-amber-300'
            }`}
          />
        </button>
      ))}
      {value ? (
        <button
          onClick={() => onChange(null)}
          className="ml-1 text-[10px] text-[var(--text-muted)] hover:text-red-600 cursor-pointer"
        >
          clear
        </button>
      ) : null}
    </div>
  )
}

function TagInput({ tags, onChange }) {
  const [input, setInput] = useState('')
  const addTag = () => {
    const t = input.trim().replace(/,/g, '')
    if (t && !tags.includes(t)) onChange([...tags, t])
    setInput('')
  }
  return (
    <div className="flex flex-wrap gap-1 items-center">
      {tags.map((t) => (
        <span key={t} className="tag bg-slate-100 text-slate-700 border border-[var(--border-color)] gap-1">
          {t}
          <button
            onClick={() => onChange(tags.filter((x) => x !== t))}
            className="hover:text-red-600 cursor-pointer"
          >
            <X className="w-2.5 h-2.5" />
          </button>
        </span>
      ))}
      <input
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ',') {
            e.preventDefault()
            addTag()
          }
          if (e.key === 'Backspace' && !input && tags.length) onChange(tags.slice(0, -1))
        }}
        onBlur={addTag}
        placeholder="add tag..."
        className="flex-1 min-w-[80px] bg-transparent text-[11px] focus:outline-none"
      />
      <button onClick={addTag} className="p-0.5 text-[var(--text-muted)] hover:text-[var(--text-main)] cursor-pointer">
        <Plus className="w-3 h-3" />
      </button>
    </div>
  )
}

export default function RunPanel({
  run, // selected saved run (or null)
  streaming,
  streamingOutput,
  streamingError,
  onUpdateFeedback,
  onRenameRun,
}) {
  const [copied, setCopied] = useState(false)
  const [view, setView] = useState('rendered') // 'rendered' | 'raw'
  const [feedback, setFeedback] = useState({ rating: null, comment: '', tags: [] })
  const [editingName, setEditingName] = useState(false)
  const [draftName, setDraftName] = useState('')

  // When the selected run changes, load its feedback into local editor state.
  useEffect(() => {
    if (run?.feedback) {
      setFeedback({
        rating: run.feedback.rating ?? null,
        comment: run.feedback.comment ?? '',
        tags: run.feedback.tags ?? [],
      })
    } else {
      setFeedback({ rating: null, comment: '', tags: [] })
    }
    // Sync editable name when run changes; close editing on switch.
    setDraftName(run?.name || '')
    setEditingName(false)
  }, [run?.id])

  const showStreaming = streaming
  const output = run?.output
  // Native LLM response lives in output.native for tool runs; streamed/plain
  // runs keep output.content (type 'text'). Default to '' when nothing present.
  const native = output?.native
  const outputContent = showStreaming
    ? streamingOutput
    : native?.kwargs?.content || output?.content || ''
  const isTool = (output?.type || '') === 'ai' && !!native
  const usage = showStreaming
    ? null
    : output?.usage || native?.kwargs?.usage_metadata || output?.usage_metadata
  const params = run?.params || {}

  const handleCopy = async () => {
    try {
      const text =
        view === 'raw'
          ? JSON.stringify(native || run?.output, null, 2)
          : outputContent
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 1200)
    } catch {}
  }

  const commitFeedback = (next) => {
    setFeedback(next)
    if (run) onUpdateFeedback(run.id, next)
  }

  const commitName = () => {
    setEditingName(false)
    if (run && onRenameRun && draftName.trim() !== (run.name || '')) {
      onRenameRun(run.id, draftName.trim())
    }
  }

  const displayName = run?.name || (showStreaming ? 'Generating response' : streamingError && !run ? 'Run failed' : 'Untitled run')

  const empty = !showStreaming && !run && !streamingError
  return (
    <section className="flex-1 flex flex-col min-w-0 min-h-0 bg-[var(--bg-panel)] border-l border-[var(--border-color)]">
      {/* Header */}
      <div className="px-4 py-2 border-b border-[var(--border-color)] shrink-0 space-y-1.5">
        {/* Row 1: run name + copy + view toggle */}
        <div className="flex items-center gap-2 min-w-0">
          <Terminal className="w-4 h-4 text-[var(--text-muted)] shrink-0" />
          {showStreaming || streamingError || !run ? (
            <span className="text-sm font-semibold text-[var(--text-main)] truncate">
              {displayName}
            </span>
          ) : editingName ? (
            <input
              autoFocus
              value={draftName}
              onChange={(e) => setDraftName(e.target.value)}
              onBlur={commitName}
              onKeyDown={(e) => {
                if (e.key === 'Enter') commitName()
                if (e.key === 'Escape') {
                  setDraftName(run?.name || '')
                  setEditingName(false)
                }
              }}
              className="flex-1 text-sm font-semibold bg-white border border-[var(--accent)] rounded px-2 py-1 text-[var(--text-main)] outline-none min-w-0"
              placeholder="Run name…"
            />
          ) : (
            <button
              onClick={() => { setDraftName(run?.name || ''); setEditingName(true) }}
              className="flex-1 text-sm font-semibold text-[var(--text-main)] truncate cursor-pointer hover:text-[var(--accent)] transition-colors min-w-0 text-left"
              title="Click to rename"
            >
              {displayName}
            </button>
          )}
          <button
            onClick={handleCopy}
            disabled={!outputContent}
            className="p-1 rounded bg-white border border-[var(--border-color)] text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-slate-50 cursor-pointer shrink-0 disabled:opacity-50"
            title="Copy output"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-green-600" /> : <Copy className="w-3.5 h-3.5" />}
          </button>
          {run?.output && !showStreaming && (
            <div className="flex items-center gap-0.5 p-0.5 rounded-md bg-[var(--bg-soft)] border border-[var(--border-color)] shrink-0">
              <button
                onClick={() => setView('rendered')}
                className={`px-2 py-0.5 rounded text-[11px] font-medium cursor-pointer ${
                  view === 'rendered'
                    ? 'bg-white text-[var(--text-main)] shadow-sm'
                    : 'text-[var(--text-muted)] hover:text-[var(--text-main)]'
                }`}
                title="Rendered view"
              >
                Rendered
              </button>
              <button
                onClick={() => setView('raw')}
                className={`px-2 py-0.5 rounded text-[11px] font-medium cursor-pointer ${
                  view === 'raw'
                    ? 'bg-white text-[var(--text-main)] shadow-sm'
                    : 'text-[var(--text-muted)] hover:text-[var(--text-main)]'
                }`}
                title="Raw original output"
              >
                Raw
              </button>
            </div>
          )}
        </div>
        {/* Row 2: params meta bar */}
        {!showStreaming && !streamingError && run && (
          <div className="flex items-center gap-3 text-[11px] text-[var(--text-muted)]">
            {params.model && (
              <span className="flex items-center gap-1">
                <Cpu className="w-3 h-3" /> <span className="font-mono">{params.model}</span>
              </span>
            )}
            {usage && <span className="font-mono">{formatTokens(usage)}</span>}
          </div>
        )}
      </div>

      {/* Body */}
      {empty ? (
        <div className="flex-1 flex flex-col items-center justify-center text-[var(--text-faint)] gap-2 p-6">
          <Terminal className="w-10 h-10 opacity-30" />
          <div className="text-sm">No run selected.</div>
          <div className="text-xs text-center max-w-[280px]">
            Compose your prompt on the left and hit <span className="font-semibold">Run prompt</span> to stream a
            response. Runs are saved automatically so you can annotate them below.
          </div>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto p-4 min-h-0">
          {view === 'raw' ? (
            <RawView output={native || run?.output} />
          ) : isTool ? (
            <div className="rounded-lg border border-[var(--border-color)] bg-[var(--bg-soft)] p-3">
              <pre className="text-xs font-mono whitespace-pre-wrap break-words text-[var(--text-main)] leading-relaxed">
                {outputContent || <span className="text-[var(--text-faint)]">(empty response)</span>}
              </pre>
              {native?.kwargs?.tool_calls?.length > 0 && (
                <ToolCallsList toolCalls={native.kwargs.tool_calls} />
              )}
            </div>
          ) : (
          <div className="rounded-lg border border-[var(--border-color)] bg-[var(--bg-soft)]">
            <pre className="p-3 text-xs font-mono whitespace-pre-wrap break-words text-[var(--text-main)] leading-relaxed min-h-[140px]">
              {streamingError ? (
                <span className="text-red-600 flex items-start gap-1.5">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{streamingError}</span>
                </span>
              ) : outputContent ? (
                outputContent
              ) : (
                <span className="text-[var(--text-faint)] animate-pulse">
                  {showStreaming ? 'Waiting for first token...' : '(empty response)'}
                </span>
              )}
              {showStreaming && outputContent && (
                <Loader2 className="w-3 h-3 inline ml-1 animate-spin text-[var(--accent)]" />
              )}
            </pre>
          </div>
          )}

          {/* Input echo */}
          {run?.input_messages?.length > 0 && (
            <details className="mt-3 group">
              <summary className="cursor-pointer text-[11px] font-semibold text-[var(--text-muted)] uppercase tracking-wider flex items-center gap-1.5 select-none">
                <MessageSquare className="w-3.5 h-3.5" /> Input messages ({run.input_messages.length})
              </summary>
              <div className="mt-2 space-y-1.5">
                {run.input_messages.map((m, i) => (
                  <div key={i} className="text-[11px] font-mono bg-[var(--bg-soft)] border border-[var(--border-color)] rounded p-2">
                    <span className="font-semibold text-[var(--text-muted)] uppercase">{m.type}: </span>
                    <span className="whitespace-pre-wrap">{m.data?.content || ''}</span>
                    {m.data?.tool_call_id && (
                      <span className="ml-1 text-[var(--text-faint)]">(tool_call_id={m.data.tool_call_id})</span>
                    )}
                  </div>
                ))}
              </div>
            </details>
          )}

          {/* Feedback / annotation */}
          {run && !showStreaming && (
            <div className="mt-4 rounded-lg border border-[var(--border-color)] bg-white p-3">
              <div className="flex items-center gap-1.5 mb-3">
                <Star className="w-3.5 h-3.5 text-amber-500" />
                <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                  Feedback &amp; annotation
                </span>
              </div>

              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <span className="text-xs font-medium text-[var(--text-main)] w-14">Rating</span>
                  <Stars
                    value={feedback.rating}
                    onChange={(rating) => commitFeedback({ ...feedback, rating })}
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-medium text-[var(--text-main)] mb-1">
                    Comment / notes
                  </label>
                  <textarea
                    value={feedback.comment}
                    onChange={(e) => setFeedback((f) => ({ ...f, comment: e.target.value }))}
                    onBlur={() => run && onUpdateFeedback(run.id, feedback)}
                    rows={3}
                    placeholder="What worked? What didn't? Hypotheses for the next iteration..."
                    className="w-full bg-[var(--bg-input)] border border-[var(--border-color)] rounded px-2 py-1.5 text-xs focus:outline-none focus:border-[var(--accent)] resize-y"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-medium text-[var(--text-main)] mb-1 flex items-center gap-1">
                    <Tag className="w-3 h-3" /> Tags
                  </label>
                  <div className="bg-[var(--bg-input)] border border-[var(--border-color)] rounded px-2 py-1.5">
                    <TagInput
                      tags={feedback.tags}
                      onChange={(tags) => commitFeedback({ ...feedback, tags })}
                    />
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  )
}

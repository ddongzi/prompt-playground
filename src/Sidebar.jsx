import React, { useState } from 'react'
import { Folder, FolderOpen, FileText, Trash2, Plus, History, Star, Zap, ChevronRight } from 'lucide-react'

function RatingDots({ rating }) {
  if (!rating) return null
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((n) => (
        <span
          key={n}
          className={`w-1.5 h-1.5 rounded-full ${n <= rating ? 'bg-amber-400' : 'bg-slate-200'}`}
        />
      ))}
    </div>
  )
}

export default function Sidebar({
  groups,
  prompts,
  runs,
  selectedGroupId,
  selectedPromptId,
  selectedRunId,
  onSelectGroup,
  onSelectPrompt,
  onSelectRun,
  onCreateGroup,
  onDeleteGroup,
  onCreatePrompt,
  onDeletePrompt,
  onDeleteRun,
}) {
  const [newGroupName, setNewGroupName] = useState('')
  const [showNewGroupInput, setShowNewGroupInput] = useState(false)

  const handleAddGroup = () => {
    if (!newGroupName.trim()) return
    onCreateGroup(newGroupName.trim())
    setNewGroupName('')
    setShowNewGroupInput(false)
  }

  return (
    <aside className="w-72 shrink-0 border-r border-[var(--border-color)] bg-[var(--bg-panel)] flex flex-col min-h-0">
      {/* Groups section */}
      <div className="flex flex-col min-h-0 flex-1">
        <div className="flex items-center justify-between px-3 py-2 border-b border-[var(--border-color)]">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
            Prompt Groups
          </span>
          <button
            onClick={() => setShowNewGroupInput((s) => !s)}
            className="p-1 rounded hover:bg-slate-100 text-[var(--text-muted)] hover:text-[var(--text-main)] cursor-pointer"
            title="New group"
          >
            <Plus className="w-3.5 h-3.5" />
          </button>
        </div>

        {showNewGroupInput && (
          <div className="px-3 py-2 border-b border-[var(--border-color)] bg-[var(--bg-soft)] flex gap-1.5">
            <input
              autoFocus
              value={newGroupName}
              onChange={(e) => setNewGroupName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleAddGroup()
                if (e.key === 'Escape') {
                  setShowNewGroupInput(false)
                  setNewGroupName('')
                }
              }}
              placeholder="Group name..."
              className="flex-1 min-w-0 bg-white border border-[var(--border-color)] rounded px-2 py-1 text-xs focus:outline-none focus:border-[var(--accent)]"
            />
            <button onClick={handleAddGroup} className="btn btn-primary !py-1 !px-2">
              Add
            </button>
          </div>
        )}

        <div className="overflow-y-auto flex-1">
          {groups.length === 0 ? (
            <div className="p-3 text-xs text-[var(--text-faint)]">
              No groups yet. Click <Plus className="w-3 h-3 inline" /> to create one.
            </div>
          ) : (
            <ul className="py-1">
              {groups.map((g) => {
                const count = prompts.filter((p) => p.group_id === g.id).length
                const active = g.id === selectedGroupId
                return (
                  <li key={g.id}>
                    <div
                      onClick={() => onSelectGroup(g.id)}
                      className={`group flex items-center gap-1.5 px-3 py-1.5 cursor-pointer text-xs ${
                        active
                          ? 'bg-[var(--accent-soft)] text-[var(--accent)]'
                          : 'hover:bg-slate-50 text-[var(--text-main)]'
                      }`}
                    >
                      {active ? (
                        <FolderOpen className="w-3.5 h-3.5 shrink-0" />
                      ) : (
                        <Folder className="w-3.5 h-3.5 shrink-0 text-[var(--text-muted)]" />
                      )}
                      <span className="flex-1 truncate font-medium">{g.name}</span>
                      <span className="text-[10px] text-[var(--text-faint)] tabular-nums">{count}</span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          if (confirm(`Delete group "${g.name}"? This removes its prompts and runs.`))
                            onDeleteGroup(g.id)
                        }}
                        className="opacity-0 group-hover:opacity-100 p-0.5 hover:text-red-600 text-[var(--text-muted)] transition-opacity cursor-pointer"
                        title="Delete group"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>

                    {/* Prompts under this group */}
                    {active && (
                      <ul className="border-l-2 border-[var(--accent-soft)] ml-3 my-0.5">
                        {prompts
                          .filter((p) => p.group_id === g.id)
                          .map((p) => {
                              const activeP = p.id === selectedPromptId
                              return (
                              <li key={p.id}>
                                <div
                                  onClick={() => onSelectPrompt(p.id)}
                                  className={`group flex items-center gap-1.5 pl-3 pr-2 py-1.5 cursor-pointer text-xs ${
                                    activeP
                                      ? 'bg-slate-100 text-[var(--text-main)]'
                                      : 'hover:bg-slate-50 text-[var(--text-main)]'
                                  }`}
                                >
                                  <FileText className="w-3 h-3 shrink-0 text-[var(--text-muted)]" />
                                  <div className="flex-1 min-w-0">
                                    <div className="truncate font-medium">{p.name}</div>
                                  </div>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      if (confirm(`Delete prompt "${p.name}"?`)) onDeletePrompt(p.id)
                                    }}
                                    className="opacity-0 group-hover:opacity-100 p-0.5 hover:text-red-600 text-[var(--text-muted)] transition-opacity cursor-pointer"
                                    title="Delete prompt"
                                  >
                                    <Trash2 className="w-3 h-3" />
                                  </button>
                                </div>
                              </li>
                            )
                          })}
                        {prompts.filter((p) => p.group_id === g.id).length === 0 && (
                          <li className="pl-3 pr-2 py-1 text-[11px] text-[var(--text-faint)]">
                            No prompts yet.
                          </li>
                        )}
                        <li>
                          <button
                            onClick={() => onCreatePrompt()}
                            className="w-full flex items-center gap-1.5 pl-3 pr-2 py-1.5 text-[11px] text-[var(--accent)] hover:bg-[var(--accent-soft)] cursor-pointer border-t border-[var(--border-color)] mt-0.5"
                            title="Create a new prompt in this group"
                          >
                            <Plus className="w-3 h-3" /> New prompt
                          </button>
                        </li>
                      </ul>
                    )}
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      </div>

      {/* Runs section for selected prompt */}
      <div className="flex flex-col min-h-0 border-t border-[var(--border-color)]" style={{ flex: '0 0 38%' }}>
        <div className="px-3 py-2 border-b border-[var(--border-color)] flex items-center gap-1.5">
          <History className="w-3.5 h-3.5 text-[var(--text-muted)]" />
          <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
            Runs
          </span>
          {selectedPromptId && (
            <span className="ml-auto text-[10px] text-[var(--text-faint)] tabular-nums">{runs.length}</span>
          )}
        </div>
        <div className="overflow-y-auto flex-1">
          {!selectedPromptId ? (
            <div className="p-3 text-xs text-[var(--text-faint)]">Select a prompt to see its run history.</div>
          ) : runs.length === 0 ? (
            <div className="p-3 text-xs text-[var(--text-faint)]">No runs yet. Send the prompt to create one.</div>
          ) : (
            <ul className="py-1">
              {runs.map((r) => {
                const active = r.id === selectedRunId
                const out = r.output?.content || ''
                const name = r.name || ''
                return (
                  <li key={r.id}>
                    <div
                      onClick={() => onSelectRun(r.id)}
                      className={`group flex items-center gap-1.5 px-3 py-1.5 cursor-pointer text-xs ${
                        active ? 'bg-[var(--accent-soft)] text-[var(--accent)]' : 'hover:bg-slate-50 text-[var(--text-main)]'
                      }`}
                    >
                      <Zap className="w-3 h-3 shrink-0 opacity-50" />
                      <div className="flex-1 min-w-0">
                        {name && (
                          <div className="truncate text-[11px] font-medium text-[var(--text-main)]">
                            {name}
                          </div>
                        )}
                        <div className="truncate text-[11px] text-[var(--text-faint)]">
                          {out ? out.slice(0, 60) : '(empty)'}
                        </div>
                        <div className="truncate font-mono text-[10px] text-[var(--text-faint)]">
                          {new Date(r.created_at).toLocaleString()}
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        {r.feedback?.rating ? <RatingDots rating={r.feedback.rating} /> : null}
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            if (confirm('Delete this run?')) onDeleteRun(r.id)
                          }}
                          className="opacity-0 group-hover:opacity-100 p-0.5 hover:text-red-600 text-[var(--text-muted)] transition-opacity cursor-pointer"
                          title="Delete run"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      </div>
    </aside>
  )
}

import { useState, useEffect, useCallback, useMemo } from 'react'
import { Zap, Settings as SettingsIcon, RotateCw, AlertCircle, Database } from 'lucide-react'
import * as store from './store'
import { streamChat, runWithTools } from './llm'
import Sidebar from './Sidebar'
import MessageEditor from './MessageEditor'
import RunPanel from './RunPanel'
import SettingsModal from './SettingsModal'
import DataModal from './DataModal'

const EMPTY_MESSAGE = { type: 'human', data: { content: '' } }

// Canonical form of a message list for dirty comparison:
// drop undefined tool_call_id on non-tool messages so switching types
// doesn't keep the prompt perpetually "dirty".
function normMessages(msgs) {
  return JSON.stringify(
    (msgs || []).map((m) => {
      const d = m.data || {}
      const out = { type: m.type, content: d.content || '' }
      if (m.type === 'tool' && d.tool_call_id) out.tool_call_id = d.tool_call_id
      if (m.type === 'ai' && d.tool_calls?.length) out.tool_calls = d.tool_calls
      return out
    })
  )
}

export default function App() {
  const [groups, setGroups] = useState([])
  const [prompts, setPrompts] = useState([])
  const [runs, setRuns] = useState([])
  const [settings, setSettings] = useState(null)

  const [selectedGroupId, setSelectedGroupId] = useState(null)
  const [selectedPromptId, setSelectedPromptId] = useState(null)
  const [selectedRunId, setSelectedRunId] = useState(null)

  // Editor state
  const [promptName, setPromptName] = useState('')
  const [messages, setMessages] = useState([EMPTY_MESSAGE])
  // Tool config bound at run time: { selected: string[], mocks: {[name]: string} }
  const [promptTools, setPromptTools] = useState({ selected: [], mocks: {} })
  // Snapshot of the saved prompt (for dirty comparison)
  const [savedSnapshot, setSavedSnapshot] = useState(null)

  // Streaming state
  const [isStreaming, setIsStreaming] = useState(false)
  const [streamingOutput, setStreamingOutput] = useState('')
  const [streamingError, setStreamingError] = useState('')

  const [isSettingsOpen, setIsSettingsOpen] = useState(false)
  const [isDataOpen, setIsDataOpen] = useState(false)
  const [toast, setToast] = useState(null)

  const showToast = useCallback((msg, kind = 'info') => {
    setToast({ msg, kind })
    setTimeout(() => setToast(null), 3000)
  }, [])

  // ---------- bootstrap ----------
  useEffect(() => {
    (async () => {
      try {
        const s = store.getSettings()
        setSettings(s)
        await store.seedDefaultTools()
        const g = await store.listGroups()
        setGroups(g)
        if (g.length > 0) setSelectedGroupId(g[0].id)
      } catch (err) {
        showToast(err.message, 'error')
      }
    })()
  }, [showToast])

  const refreshPrompts = useCallback(async () => {
    try {
      const data = await store.listPrompts()
      setPrompts(data)
    } catch (err) {
      showToast(err.message, 'error')
    }
  }, [showToast])

  useEffect(() => {
    refreshPrompts()
  }, [refreshPrompts, selectedGroupId])

  // ---------- prompt selection ----------
  const loadPrompt = useCallback(
    async (id) => {
      try {
        const p = await store.getPrompt(id)
        if (!p) return
        setSelectedPromptId(id)
        setPromptName(p.name || '')
        setMessages(p.messages?.length ? p.messages : [EMPTY_MESSAGE])
        setPromptTools({
          selected: p.tools?.selected || [],
          mocks: p.tools?.mocks || {},
        })
        setSavedSnapshot({
          name: p.name || '',
          messages: normMessages(p.messages || []),
          tools: JSON.stringify({
            selected: p.tools?.selected || [],
            mocks: p.tools?.mocks || {},
          }),
        })
        setSelectedRunId(null)
        setStreamingOutput('')
        setStreamingError('')
        setIsStreaming(false)
        const rs = await store.listRuns(id)
        setRuns(rs)
        if (rs.length > 0) setSelectedRunId(rs[0].id)
      } catch (err) {
        showToast(err.message, 'error')
      }
    },
    [settings, showToast]
  )

  const handleSelectGroup = useCallback((id) => {
    setSelectedGroupId(id)
  }, [])

  const handleSelectPrompt = useCallback(
    (id) => {
      if (id === selectedPromptId) return
      loadPrompt(id)
    },
    [selectedPromptId, loadPrompt]
  )

  const handleNewPrompt = useCallback(() => {
    if (!selectedGroupId) {
      showToast('Create or select a group first.', 'error')
      return
    }
    setSelectedPromptId(null)
    setSelectedRunId(null)
    setRuns([])
    setPromptName('')
    setMessages([{ type: 'system', data: { content: '' } }, { ...EMPTY_MESSAGE }])
    setPromptTools({ selected: [], mocks: {} })
    setSavedSnapshot(null)
    setStreamingOutput('')
    setStreamingError('')
  }, [selectedGroupId, settings])

  // ---------- dirty check ----------
  const dirty = useMemo(() => {
    if (!savedSnapshot) return true
    if ((promptName || '') !== savedSnapshot.name) return true
    if (normMessages(messages) !== savedSnapshot.messages) return true
    const savedT = savedSnapshot.tools
    if (savedT !== undefined) {
      const currentT = JSON.stringify({
        selected: promptTools.selected || [],
        mocks: promptTools.mocks || {},
      })
      if (currentT !== savedT) return true
    }
    return false
  }, [promptName, messages, savedSnapshot, promptTools])

  // ---------- groups CRUD ----------
  const handleCreateGroup = useCallback(
    async (name) => {
      try {
        const g = await store.createGroup(name)
        setGroups((prev) => [...prev, g])
        setSelectedGroupId(g.id)
      } catch (err) {
        showToast(err.message, 'error')
      }
    },
    [showToast]
  )

  const handleDeleteGroup = useCallback(
    async (id) => {
      try {
        await store.deleteGroup(id)
        setGroups((prev) => prev.filter((g) => g.id !== id))
        setPrompts((prev) => prev.filter((p) => p.group_id !== id))
        if (selectedGroupId === id) {
          setSelectedGroupId(null)
          setSelectedPromptId(null)
          setRuns([])
        }
      } catch (err) {
        showToast(err.message, 'error')
      }
    },
    [selectedGroupId, showToast]
  )

  // ---------- prompts CRUD ----------
  // Shared by Save button and Run: ensures the prompt is persisted so that
  // a run can be attached to it. Returns the prompt id, or null on failure.
  const persistPrompt = useCallback(async () => {
    const cleanedMessages = messages
      .filter((m) => (m.data?.content || '').trim() !== '' || m.type === 'tool')
    if (cleanedMessages.length === 0) {
      showToast('Add at least one non-empty message.', 'error')
      return null
    }
    if (!promptName.trim()) {
      showToast('Give the prompt a name first.', 'error')
      return null
    }
    if (!selectedGroupId) {
      showToast('Select or create a group first.', 'error')
      return null
    }
    // Already saved and unchanged — no need to write.
    if (selectedPromptId && !dirty) return selectedPromptId
    try {
      if (selectedPromptId) {
        const updated = await store.updatePrompt(selectedPromptId, {
          name: promptName.trim(),
          messages: cleanedMessages,
          tools: promptTools,
        })
        setPrompts((prev) => prev.map((p) => (p.id === updated.id ? updated : p)))
        setSavedSnapshot({
          name: updated.name,
          messages: normMessages(updated.messages || []),
          tools: JSON.stringify({
            selected: updated.tools?.selected || [],
            mocks: updated.tools?.mocks || {},
          }),
        })
        return updated.id
      }
      const created = await store.createPrompt({
        group_id: selectedGroupId,
        name: promptName.trim(),
        messages: cleanedMessages,
        tools: promptTools,
      })
      setPrompts((prev) => [created, ...prev])
      setSelectedPromptId(created.id)
      setSavedSnapshot({
        name: created.name,
        messages: normMessages(created.messages || []),
        tools: JSON.stringify({
          selected: created.tools?.selected || [],
          mocks: created.tools?.mocks || {},
        }),
      })
      return created.id
    } catch (err) {
      showToast(err.message, 'error')
      return null
    }
  }, [messages, promptName, selectedGroupId, selectedPromptId, promptTools, dirty, showToast])

  // Auto-name for runs: first user message, truncated.
  const runNameFrom = useCallback((msgs) => {
    const u = msgs.find((m) => m.type === 'human' || m.type === 'user')
    const text = (u?.data?.content || '').trim()
    return text ? text.slice(0, 40) + (text.length > 40 ? '…' : '') : ''
  }, [])

  const handleRenameRun = useCallback(async (id, name) => {
    await store.renameRun(id, name)
    setRuns((prev) => prev.map((r) => (r.id === id ? { ...r, name } : r)))
  }, [setRuns])

  const handleSave = useCallback(async () => {
    const wasNew = !selectedPromptId
    const id = await persistPrompt()
    if (id) showToast(wasNew ? 'Prompt created.' : 'Prompt saved.', 'success')
  }, [persistPrompt, selectedPromptId, showToast])

  const handleDeletePrompt = useCallback(
    async (id) => {
      try {
        await store.deletePrompt(id)
        setPrompts((prev) => prev.filter((p) => p.id !== id))
        if (selectedPromptId === id) {
          setSelectedPromptId(null)
          setRuns([])
          setSelectedRunId(null)
          setPromptName('')
          setMessages([EMPTY_MESSAGE])
          setSavedSnapshot(null)
        }
      } catch (err) {
        showToast(err.message, 'error')
      }
    },
    [selectedPromptId, showToast]
  )

  // ---------- runs ----------
  const handleDeleteRun = useCallback(
    async (id) => {
      try {
        await store.deleteRun(id)
        setRuns((prev) => prev.filter((r) => r.id !== id))
        if (selectedRunId === id) setSelectedRunId(null)
      } catch (err) {
        showToast(err.message, 'error')
      }
    },
    [selectedRunId, showToast]
  )

  const handleUpdateFeedback = useCallback(
    async (id, feedback) => {
      // optimistic
      setRuns((prev) =>
        prev.map((r) => (r.id === id ? { ...r, feedback: { ...feedback } } : r))
      )
      try {
        await store.updateRunFeedback(id, feedback)
      } catch (err) {
        showToast(err.message, 'error')
      }
    },
    [showToast]
  )

  // ---------- chat (streaming) ----------
  const handleSend = useCallback(async () => {
    const cleaned = messages
      .filter((m) => (m.data?.content || '').trim() !== '' || m.type === 'tool')
    if (cleaned.length === 0) {
      showToast('Add at least one non-empty message.', 'error')
      return
    }
    if (!settings?.has_api_key) {
      setIsSettingsOpen(true)
      return
    }

    // Auto-save the prompt so the run can be persisted & annotated.
    // Without this, the streamed output would vanish after streaming ends.
    const promptId = await persistPrompt()
    if (!promptId) return

    setIsStreaming(true)
    setStreamingOutput('')
    setStreamingError('')
    setSelectedRunId(null)

    const selectedTools = promptTools.selected || []
    try {
      if (selectedTools.length > 0) {
        // ---- single-shot tool observation (native LLM response) ----
        const result = await runWithTools(
          cleaned,
          settings,
          selectedTools,
          promptTools.mocks || {},
          (status) => setStreamingOutput((prev) => prev + status + '\n')
        )
        // Store the UNTRANSFORMED native response, plus the derived render helper.
        const output = {
          type: 'ai',
          native: result.native,
          mockSteps: result.mockSteps,
        }
        const name = runNameFrom(cleaned)
        const run = await store.createRun(promptId, cleaned, output, {
          model: settings.model,
          tools: selectedTools,
        }, name)
        setRuns((prev) => [run, ...prev])
        setSelectedRunId(run.id)
        setStreamingError('')
      } else {
        // ---- plain streaming chat ----
        let acc = ''
        let usage = null
        for await (const evt of streamChat(cleaned, settings)) {
          if (evt.type === 'token') {
            acc += evt.delta
            setStreamingOutput(acc)
          } else if (evt.type === 'usage') {
            usage = evt.usage
          } else if (evt.type === 'error') {
            // keep the error visible in the output panel after streaming ends
            setStreamingError(evt.message || 'Unknown error')
            setIsStreaming(false)
            return
          }
          // 'done' falls through to persistence below
        }
        const output = { type: 'ai', content: acc }
        if (usage) output.usage = usage
        const name = runNameFrom(cleaned)
        const run = await store.createRun(promptId, cleaned, output, {
          model: settings.model,
        }, name)
        setRuns((prev) => [run, ...prev])
        setSelectedRunId(run.id)
        setStreamingError('')
      }
    } catch (err) {
      setStreamingError(err.message || 'Stream failed')
    } finally {
      setIsStreaming(false)
    }
  }, [messages, settings, promptTools, persistPrompt, showToast])

  // ---------- settings ----------
  const handleSaveSettings = useCallback(
    async (payload) => {
      const saved = store.saveSettings(payload)
      setSettings(saved)
      showToast('Settings saved.', 'success')
    },
    [showToast]
  )

  // Reload from storage after raw edits / imports in the data manager.
  // Preserves the current selection when the selected prompt still exists.
  const handleDataChanged = useCallback(async () => {
    const s = store.getSettings()
    setSettings(s)
    const g = await store.listGroups()
    setGroups(g)
    const p = await store.listPrompts()
    setPrompts(p)
    const stillExists = selectedPromptId && p.some((x) => x.id === selectedPromptId)
    if (stillExists) {
      const rs = await store.listRuns(selectedPromptId)
      setRuns(rs)
      if (selectedRunId && !rs.some((r) => r.id === selectedRunId)) {
        setSelectedRunId(null)
      }
    } else {
      setSelectedPromptId(null)
      setSelectedRunId(null)
      setRuns([])
      setPromptName('')
      setMessages([EMPTY_MESSAGE])
      setSavedSnapshot(null)
    }
  }, [selectedPromptId, selectedRunId])

  const selectedRun = useMemo(
    () => runs.find((r) => r.id === selectedRunId) || null,
    [runs, selectedRunId]
  )

  // Selecting a run from the sidebar should clear any stale stream/error view.
  const handleSelectRun = useCallback((id) => {
    setSelectedRunId(id)
    setStreamingOutput('')
    setStreamingError('')
    setIsStreaming(false)
  }, [])

  const hasApiKey = !!settings?.has_api_key

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden">
      {/* Header */}
      <header className="h-12 shrink-0 border-b border-[var(--border-color)] bg-[var(--bg-panel)] px-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-md bg-[var(--accent)] text-white flex items-center justify-center shadow-sm">
            <Zap className="w-4 h-4" />
          </div>
          <div className="leading-tight">
            <div className="text-sm font-bold text-[var(--text-main)]">Prompt Playground</div>
            <div className="text-[10px] text-[var(--text-muted)] -mt-0.5">
              LangChain Messages · DeepSeek · local JSONL
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button onClick={() => refreshPrompts()} className="btn btn-ghost" title="Refresh">
            <RotateCw className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => setIsDataOpen(true)}
            className="btn btn-ghost"
            title="View & manage raw JSONL data"
          >
            <Database className="w-4 h-4" />
            <span className="hidden sm:inline">Data</span>
          </button>
          <button onClick={() => setIsSettingsOpen(true)} className="btn btn-ghost" title="Settings">
            <SettingsIcon className="w-4 h-4" />
            <span className="hidden sm:inline">{hasApiKey ? settings?.model : 'Set API key'}</span>
          </button>
        </div>
      </header>

      {/* Body */}
      <div className="flex-1 flex min-h-0 min-w-0">
        <Sidebar
          groups={groups}
          prompts={prompts}
          runs={runs}
          selectedGroupId={selectedGroupId}
          selectedPromptId={selectedPromptId}
          selectedRunId={selectedRunId}
          onSelectGroup={handleSelectGroup}
          onSelectPrompt={handleSelectPrompt}
          onSelectRun={handleSelectRun}
          onCreateGroup={handleCreateGroup}
          onDeleteGroup={handleDeleteGroup}
          onCreatePrompt={handleNewPrompt}
          onDeletePrompt={handleDeletePrompt}
          onDeleteRun={handleDeleteRun}
        />

        <MessageEditor
          promptName={promptName}
          setPromptName={setPromptName}
          messages={messages}
          setMessages={setMessages}
          onSend={handleSend}
          loading={isStreaming}
          hasApiKey={hasApiKey}
          hasPrompt={!!selectedPromptId}
          dirty={dirty}
          onSave={handleSave}
          promptTools={promptTools}
          setPromptTools={setPromptTools}
        />

        <RunPanel
          run={selectedRun}
          streaming={isStreaming}
          streamingOutput={streamingOutput}
          streamingError={streamingError}
          onUpdateFeedback={handleUpdateFeedback}
          onRenameRun={handleRenameRun}
        />
      </div>

      {/* Toast */}
      {toast && (
        <div
          className={`fixed bottom-4 left-1/2 -translate-x-1/2 z-50 px-3 py-2 rounded-md shadow-lg text-xs flex items-center gap-2 ${
            toast.kind === 'error'
              ? 'bg-red-600 text-white'
              : toast.kind === 'success'
              ? 'bg-emerald-600 text-white'
              : 'bg-slate-800 text-white'
          }`}
        >
          {toast.kind === 'error' && <AlertCircle className="w-3.5 h-3.5" />}
          {toast.msg}
        </div>
      )}

      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        settings={settings}
        onSave={handleSaveSettings}
      />

      <DataModal
        isOpen={isDataOpen}
        onClose={() => setIsDataOpen(false)}
        onChanged={handleDataChanged}
      />
    </div>
  )
}

'use client'

import { useEffect, useState, useRef, useTransition } from 'react'
import { getPipelineStatus, approvePlan, startPipeline, pausePipeline } from '@/actions/ai'
import type { SerializedPipelineRun, SerializedPipelineMessage } from '@/types'

interface Props {
  cardId: string
  currentStatus: string
  onStatusChange: () => void
}

// --- Constants ---

const STAGES = ['Idea', 'Suunnittelu', 'Toteutus', 'Testaus', 'Valmis'] as const

const STATUS_TO_STAGE_INDEX: Record<string, number> = {
  IDLE: 0,
  QUEUED: 0,
  PLANNING: 1,
  AWAITING_APPROVAL: 1,
  EXECUTING: 2,
  TESTING: 3,
  COMPLETED: 4,
  FAILED: -1,
  PAUSED: -1,
}

const STATUS_LABELS: Record<string, string> = {
  IDLE: 'Odottaa',
  QUEUED: 'Jonossa',
  PLANNING: 'Suunnitellaan...',
  AWAITING_APPROVAL: 'Odottaa hyvaksyntaa',
  EXECUTING: 'Toteutetaan...',
  TESTING: 'Testataan...',
  COMPLETED: 'Valmis',
  FAILED: 'Epaonnistui',
  PAUSED: 'Pysaytetty',
}

function formatDate(isoString: string): string {
  return new Intl.DateTimeFormat('fi-FI', {
    day: 'numeric',
    month: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(isoString))
}

// --- Subcomponents ---

function ProgressStepper({ status, failedStage }: { status: string; failedStage?: string }) {
  const currentIdx = STATUS_TO_STAGE_INDEX[status] ?? 0
  const failedIdx = failedStage ? STATUS_TO_STAGE_INDEX[failedStage] ?? -1 : -1
  const isFailed = status === 'FAILED'
  const isPaused = status === 'PAUSED'

  return (
    <div className="flex items-center gap-0 w-full px-2 py-4">
      {STAGES.map((stage, idx) => {
        const isCompleted = !isFailed && !isPaused && currentIdx > idx
        const isActive = currentIdx === idx && !isFailed && !isPaused
        const isFailedStep = isFailed && failedIdx === idx
        const isPausedStep = isPaused && failedIdx === idx

        return (
          <div key={stage} className="flex items-center flex-1 last:flex-none">
            {/* Step circle */}
            <div className="flex flex-col items-center gap-1.5">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold transition-all duration-300 ${
                  isCompleted
                    ? 'bg-[#34C759] text-white'
                    : isActive
                    ? 'bg-[#007AFF] text-white shadow-[0_0_0_4px_rgba(0,122,255,0.15)]'
                    : isFailedStep
                    ? 'bg-[#FF3B30] text-white'
                    : isPausedStep
                    ? 'bg-[#FF9500] text-white'
                    : 'bg-gray-200 text-gray-400'
                }`}
              >
                {isCompleted ? (
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                    <path d="M2.5 7.5L5.5 10.5L11.5 3.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                ) : isFailedStep ? (
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                    <path d="M2 2L10 10M10 2L2 10" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                  </svg>
                ) : (
                  idx + 1
                )}
              </div>
              <span className={`text-[11px] font-medium whitespace-nowrap ${
                isCompleted ? 'text-[#34C759]'
                : isActive ? 'text-[#007AFF]'
                : isFailedStep ? 'text-[#FF3B30]'
                : 'text-gray-400'
              }`}>
                {stage}
              </span>
            </div>
            {/* Connector line */}
            {idx < STAGES.length - 1 && (
              <div className={`flex-1 h-0.5 mx-1 mt-[-20px] rounded-full transition-colors duration-300 ${
                isCompleted ? 'bg-[#34C759]' : 'bg-gray-200'
              }`} />
            )}
          </div>
        )
      })}
    </div>
  )
}

function PlanReview({
  plan,
  cardId,
  onAction,
}: {
  plan: string
  cardId: string
  onAction: () => void
}) {
  const [editing, setEditing] = useState(false)
  const [editedPlan, setEditedPlan] = useState(plan)
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  function handleApprove() {
    setError(null)
    startTransition(async () => {
      const result = await approvePlan({
        cardId,
        editedPlan: editing && editedPlan !== plan ? editedPlan : undefined,
      })
      if (!result.success) {
        setError(result.error)
      } else {
        onAction()
      }
    })
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <div className="w-2 h-2 rounded-full bg-[#FF9500]" />
        <h3 className="text-[15px] font-semibold text-gray-900">Suunnitelma odottaa hyvaksyntaa</h3>
      </div>

      {editing ? (
        <textarea
          value={editedPlan}
          onChange={(e) => setEditedPlan(e.target.value)}
          className="w-full rounded-xl border border-gray-200 bg-white text-[14px] text-gray-800 p-4 min-h-[200px] resize-y focus:outline-none focus:ring-2 focus:ring-[#007AFF]/30 focus:border-[#007AFF] font-mono leading-relaxed"
        />
      ) : (
        <div className="rounded-xl bg-gray-50 border border-gray-100 p-4 max-h-[300px] overflow-y-auto">
          <pre className="whitespace-pre-wrap text-[14px] text-gray-800 font-mono leading-relaxed">{plan}</pre>
        </div>
      )}

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={handleApprove}
          disabled={isPending}
          className="bg-[#007AFF] hover:bg-[#0066DD] active:scale-[0.98] text-white px-5 py-2.5 rounded-full text-[14px] font-semibold disabled:opacity-50 transition-all duration-200 shadow-sm"
        >
          {isPending ? 'Kaynnistetaan...' : 'Hyvaksy ja jatka'}
        </button>
        <button
          type="button"
          onClick={() => {
            setEditing(!editing)
            if (!editing) setEditedPlan(plan)
          }}
          className="text-[#007AFF] hover:text-[#0066DD] active:scale-[0.98] px-4 py-2.5 rounded-full text-[14px] font-medium transition-all duration-200 hover:bg-[#007AFF]/5"
        >
          {editing ? 'Nayta esikatselu' : 'Muokkaa'}
        </button>
      </div>
      {error && (
        <div className="rounded-xl bg-[#FF3B30]/5 border border-[#FF3B30]/10 px-4 py-3 text-[13px] text-[#FF3B30]">
          {error}
        </div>
      )}
    </div>
  )
}

function MessageBubble({ msg }: { msg: SerializedPipelineMessage }) {
  const [expanded, setExpanded] = useState(false)
  const isUser = msg.role === 'user'
  const lines = msg.content.split('\n')
  const isLong = lines.length > 12
  const displayContent = isLong && !expanded ? lines.slice(0, 10).join('\n') + '\n...' : msg.content

  const artifactLabels: Record<string, string> = {
    plan: 'Suunnitelma',
    code: 'Koodi',
    execution: 'Toteutus',
    test_report: 'Testiraportti',
  }

  return (
    <div className={`flex ${isUser ? 'justify-start' : 'justify-end'}`}>
      <div className={`max-w-[85%] rounded-2xl px-4 py-3 ${
        isUser
          ? 'bg-gray-100 text-gray-800'
          : 'bg-[#007AFF] text-white'
      }`}>
        <div className="flex items-center gap-2 mb-1.5">
          <span className={`text-[11px] font-semibold ${isUser ? 'text-gray-500' : 'text-white/70'}`}>
            {isUser ? 'Jarjestelma' : 'Tekoaly'}
          </span>
          {msg.artifactType && (
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${
              isUser
                ? 'bg-gray-200 text-gray-600'
                : 'bg-white/20 text-white'
            }`}>
              {artifactLabels[msg.artifactType] ?? msg.artifactType}
            </span>
          )}
          <span className={`text-[10px] ml-auto ${isUser ? 'text-gray-400' : 'text-white/50'}`}>
            {formatDate(msg.createdAt)}
          </span>
        </div>
        <pre className={`whitespace-pre-wrap text-[13px] leading-relaxed font-mono ${
          isUser ? 'text-gray-700' : 'text-white/95'
        }`}>
          {displayContent}
        </pre>
        {isLong && (
          <button
            type="button"
            onClick={() => setExpanded(!expanded)}
            className={`mt-2 text-[12px] font-medium ${
              isUser ? 'text-[#007AFF]' : 'text-white/80 hover:text-white'
            }`}
          >
            {expanded ? 'Nayta vahemman' : 'Nayta kaikki'}
          </button>
        )}
      </div>
    </div>
  )
}

function CompletedSummary({ run }: { run: SerializedPipelineRun }) {
  const planMsg = run.messages.find(m => m.artifactType === 'plan')
  const execMsg = run.messages.find(m => m.artifactType === 'code' || m.artifactType === 'execution')
  const testMsg = run.messages.find(m => m.artifactType === 'test_report')

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-full bg-[#34C759]/10 flex items-center justify-center">
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
            <path d="M4 10.5L8 14.5L16 5.5" stroke="#34C759" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </div>
        <div>
          <h3 className="text-[16px] font-semibold text-gray-900">Pipeline valmis</h3>
          <p className="text-[13px] text-gray-500">Kaikki vaiheet suoritettu onnistuneesti</p>
        </div>
      </div>

      {/* Summary sections */}
      {planMsg && (
        <SummarySection title="Suunnitelma" content={planMsg.content} icon="plan" />
      )}
      {execMsg && (
        <SummarySection title="Toteutus" content={execMsg.content} icon="exec" />
      )}
      {testMsg && (
        <SummarySection title="Testiraportti" content={testMsg.content} icon="test" />
      )}
    </div>
  )
}

function SummarySection({ title, content, icon }: { title: string; content: string; icon: string }) {
  const [expanded, setExpanded] = useState(false)
  const lines = content.split('\n')
  const preview = lines.slice(0, 6).join('\n')
  const isLong = lines.length > 6

  const icons: Record<string, { bg: string; color: string }> = {
    plan: { bg: 'bg-[#007AFF]/10', color: 'text-[#007AFF]' },
    exec: { bg: 'bg-[#5856D6]/10', color: 'text-[#5856D6]' },
    test: { bg: 'bg-[#34C759]/10', color: 'text-[#34C759]' },
  }

  const style = icons[icon] ?? icons.plan

  return (
    <div className="rounded-2xl border border-gray-100 bg-white overflow-hidden">
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-3 p-4 hover:bg-gray-50 transition-colors text-left"
      >
        <div className={`w-8 h-8 rounded-lg ${style.bg} flex items-center justify-center`}>
          <span className={`text-[14px] font-bold ${style.color}`}>
            {icon === 'plan' ? 'S' : icon === 'exec' ? 'T' : 'R'}
          </span>
        </div>
        <span className="text-[14px] font-semibold text-gray-900 flex-1">{title}</span>
        <svg
          width="16" height="16" viewBox="0 0 16 16" fill="none"
          className={`text-gray-400 transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`}
        >
          <path d="M4 6L8 10L12 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </button>
      {expanded && (
        <div className="px-4 pb-4 border-t border-gray-50">
          <pre className="whitespace-pre-wrap text-[13px] text-gray-700 font-mono leading-relaxed mt-3">{content}</pre>
        </div>
      )}
      {!expanded && isLong && (
        <div className="px-4 pb-3">
          <pre className="whitespace-pre-wrap text-[12px] text-gray-500 font-mono leading-relaxed line-clamp-3">{preview}</pre>
        </div>
      )}
    </div>
  )
}

function ActionBar({
  cardId,
  status,
  onAction,
}: {
  cardId: string
  status: string
  onAction: () => void
}) {
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const canStart = status === 'IDLE'
  const canRetry = ['FAILED', 'PAUSED', 'QUEUED'].includes(status)
  const canPause = ['PLANNING', 'EXECUTING', 'TESTING'].includes(status)

  if (!canStart && !canRetry && !canPause) return null

  function handleAction(action: 'start' | 'pause') {
    setError(null)
    startTransition(async () => {
      const result = action === 'pause'
        ? await pausePipeline({ cardId })
        : await startPipeline({ cardId })
      if (!result.success) {
        setError(result.error)
      } else {
        onAction()
      }
    })
  }

  return (
    <div className="flex flex-col gap-2 pt-4 border-t border-gray-100">
      <div className="flex items-center gap-3">
        {canPause && (
          <button
            type="button"
            onClick={() => handleAction('pause')}
            disabled={isPending}
            className="bg-[#FF9500] hover:bg-[#E68600] active:scale-[0.98] text-white px-5 py-2.5 rounded-full text-[14px] font-semibold disabled:opacity-50 transition-all duration-200"
          >
            {isPending ? 'Odota...' : 'Pysayta'}
          </button>
        )}
        {(canRetry || canStart) && (
          <button
            type="button"
            onClick={() => handleAction('start')}
            disabled={isPending}
            className="bg-[#007AFF] hover:bg-[#0066DD] active:scale-[0.98] text-white px-5 py-2.5 rounded-full text-[14px] font-semibold disabled:opacity-50 transition-all duration-200 shadow-sm"
          >
            {isPending ? 'Kaynnistetaan...' : canStart ? 'Kaynnista pipeline' : 'Kaynnista uudelleen'}
          </button>
        )}
      </div>
      {error && (
        <div className="rounded-xl bg-[#FF3B30]/5 border border-[#FF3B30]/10 px-4 py-3 text-[13px] text-[#FF3B30]">
          {error}
        </div>
      )}
    </div>
  )
}

// --- Main Component ---

export default function PipelineView({ cardId, currentStatus, onStatusChange }: Props) {
  const [run, setRun] = useState<SerializedPipelineRun | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)

    getPipelineStatus({ cardId }).then((result) => {
      if (cancelled) return
      if (!result.success) {
        setError(result.error)
      } else {
        setRun(result.data.run as unknown as SerializedPipelineRun)
      }
      setLoading(false)
    })

    return () => { cancelled = true }
  }, [cardId, currentStatus])

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [run?.messages?.length])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="w-6 h-6 border-2 border-[#007AFF] border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="rounded-xl bg-[#FF3B30]/5 border border-[#FF3B30]/10 px-4 py-3 text-[14px] text-[#FF3B30]">
        {error}
      </div>
    )
  }

  const isCompleted = currentStatus === 'COMPLETED'
  const isAwaitingApproval = currentStatus === 'AWAITING_APPROVAL'
  const planMsg = run?.messages.find(m => m.artifactType === 'plan')

  // Determine failed stage for stepper
  const failedStage = run?.stage

  return (
    <div className="flex flex-col gap-5">
      {/* Status badge */}
      <div className="flex items-center gap-2">
        <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[12px] font-semibold ${
          currentStatus === 'COMPLETED' ? 'bg-[#34C759]/10 text-[#34C759]'
          : currentStatus === 'FAILED' ? 'bg-[#FF3B30]/10 text-[#FF3B30]'
          : currentStatus === 'AWAITING_APPROVAL' ? 'bg-[#FF9500]/10 text-[#FF9500]'
          : currentStatus === 'PAUSED' ? 'bg-gray-100 text-gray-500'
          : 'bg-[#007AFF]/10 text-[#007AFF]'
        }`}>
          {['QUEUED', 'PLANNING', 'EXECUTING', 'TESTING'].includes(currentStatus) && (
            <span className="w-1.5 h-1.5 rounded-full bg-current animate-pulse" />
          )}
          {STATUS_LABELS[currentStatus] ?? currentStatus}
        </span>
      </div>

      {/* Progress stepper */}
      <ProgressStepper status={currentStatus} failedStage={failedStage} />

      {/* Error display */}
      {run?.error && (
        <div className="rounded-2xl bg-[#FF3B30]/5 border border-[#FF3B30]/10 p-4">
          <div className="flex items-start gap-3">
            <div className="w-6 h-6 rounded-full bg-[#FF3B30]/10 flex items-center justify-center mt-0.5 shrink-0">
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                <path d="M2 2L10 10M10 2L2 10" stroke="#FF3B30" strokeWidth="2" strokeLinecap="round"/>
              </svg>
            </div>
            <div>
              <p className="text-[13px] font-semibold text-[#FF3B30] mb-1">Virhe</p>
              <p className="text-[13px] text-[#FF3B30]/80">{run.error}</p>
            </div>
          </div>
        </div>
      )}

      {/* Plan review (when awaiting approval) */}
      {isAwaitingApproval && planMsg && (
        <PlanReview
          plan={planMsg.content}
          cardId={cardId}
          onAction={onStatusChange}
        />
      )}

      {/* Completed summary */}
      {isCompleted && run && (
        <CompletedSummary run={run} />
      )}

      {/* Messages (when not completed and not awaiting approval — show during active stages) */}
      {!isCompleted && !isAwaitingApproval && run && run.messages.length > 0 && (
        <div className="flex flex-col gap-3 max-h-[350px] overflow-y-auto pr-1">
          {run.messages.map((msg) => (
            <MessageBubble key={msg.id} msg={msg} />
          ))}
          <div ref={messagesEndRef} />
        </div>
      )}

      {/* No messages placeholder */}
      {!run && currentStatus === 'IDLE' && (
        <div className="text-center py-8">
          <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-3">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
              <path d="M12 2L2 7L12 12L22 7L12 2Z" stroke="#8E8E93" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M2 17L12 22L22 17" stroke="#8E8E93" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M2 12L12 17L22 12" stroke="#8E8E93" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <p className="text-[14px] text-gray-500">Ei pipeline-ajoja</p>
          <p className="text-[12px] text-gray-400 mt-1">Luo kortti Idea-sarakkeeseen kaynnistaksesi pipelinen</p>
        </div>
      )}

      {/* Action bar */}
      <ActionBar cardId={cardId} status={currentStatus} onAction={onStatusChange} />
    </div>
  )
}

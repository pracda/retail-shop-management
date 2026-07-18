import { useEffect, useRef, useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { askAdmin, type ChatMessage } from '../../services/assistantService'

const SUGGESTIONS = [
  'How did sales do today vs the last 7 days?',
  'Which products are running low on stock?',
  'What is my gross margin over the last 30 days?',
  'What are my top selling products this month?',
]

function extractError(e: unknown): string {
  const err = e as { response?: { status?: number; data?: { error?: { message?: string } } } }
  if (err?.response?.status === 503) {
    return 'The AI assistant is not enabled on this server yet.'
  }
  return err?.response?.data?.error?.message ?? 'Something went wrong. Please try again.'
}

export default function AssistantPanel() {
  const [open, setOpen] = useState(false)
  const [input, setInput] = useState('')
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const scrollRef = useRef<HTMLDivElement>(null)

  const mut = useMutation({
    mutationFn: (message: string) =>
      askAdmin({ message, history: messages.slice(-8) }),
    onSuccess: (res) => {
      setMessages((m) => [...m, { role: 'assistant', content: res.reply }])
    },
    onError: (e) => {
      setMessages((m) => [...m, { role: 'assistant', content: `⚠️ ${extractError(e)}` }])
    },
  })

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages, mut.isPending])

  function send(text: string) {
    const message = text.trim()
    if (!message || mut.isPending) return
    setMessages((m) => [...m, { role: 'user', content: message }])
    setInput('')
    mut.mutate(message)
  }

  return (
    <>
      {/* Floating button */}
      {!open && (
        <button
          onClick={() => setOpen(true)}
          className="fixed bottom-6 right-6 z-40 flex items-center gap-2 pl-4 pr-5 py-3 rounded-full
                     bg-primary-600 hover:bg-primary-700 text-white shadow-2xl transition-colors"
          title="Ask the store assistant"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
            <path strokeLinecap="round" strokeLinejoin="round"
              d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-4 4v-4z" />
          </svg>
          <span className="text-sm font-semibold">Ask AI</span>
        </button>
      )}

      {/* Slide-in panel */}
      <div
        className={`fixed top-0 right-0 z-50 h-full w-full max-w-md bg-surface-800 border-l border-surface-700
                    shadow-2xl flex flex-col transition-transform duration-300
                    ${open ? 'translate-x-0' : 'translate-x-full'}`}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-surface-700 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-primary-600 flex items-center justify-center">
              <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                <path strokeLinecap="round" strokeLinejoin="round"
                  d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-4 4v-4z" />
              </svg>
            </div>
            <div>
              <div className="text-white font-semibold text-sm leading-none">Store Assistant</div>
              <div className="text-surface-400 text-xs mt-0.5">Answers from your store data</div>
            </div>
          </div>
          <div className="flex items-center gap-1">
            {messages.length > 0 && (
              <button
                onClick={() => setMessages([])}
                className="text-surface-400 hover:text-white text-xs px-2 py-1 rounded-lg hover:bg-surface-700"
                title="Clear conversation"
              >
                Clear
              </button>
            )}
            <button
              onClick={() => setOpen(false)}
              className="text-surface-400 hover:text-white p-1 rounded-lg hover:bg-surface-700"
              title="Close"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Messages */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
          {messages.length === 0 && (
            <div className="text-center pt-6">
              <p className="text-surface-300 text-sm mb-4">
                Ask about sales, inventory, margins and more — grounded in this store's live data.
              </p>
              <div className="space-y-2 text-left">
                {SUGGESTIONS.map((s) => (
                  <button
                    key={s}
                    onClick={() => send(s)}
                    className="w-full text-left px-3 py-2.5 rounded-lg bg-surface-900 border border-surface-700
                               text-surface-200 text-sm hover:border-primary-600 hover:text-white transition-colors"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((m, i) => (
            <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div
                className={`max-w-[85%] px-3.5 py-2.5 rounded-2xl text-sm whitespace-pre-wrap leading-relaxed
                  ${m.role === 'user'
                    ? 'bg-primary-600 text-white rounded-br-sm'
                    : 'bg-surface-900 border border-surface-700 text-surface-100 rounded-bl-sm'
                  }`}
              >
                {m.content}
              </div>
            </div>
          ))}

          {mut.isPending && (
            <div className="flex justify-start">
              <div className="bg-surface-900 border border-surface-700 rounded-2xl rounded-bl-sm px-4 py-3">
                <div className="flex gap-1">
                  <span className="w-2 h-2 bg-surface-400 rounded-full animate-bounce [animation-delay:-0.3s]" />
                  <span className="w-2 h-2 bg-surface-400 rounded-full animate-bounce [animation-delay:-0.15s]" />
                  <span className="w-2 h-2 bg-surface-400 rounded-full animate-bounce" />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Input */}
        <div className="border-t border-surface-700 p-3 shrink-0">
          <form
            onSubmit={(e) => { e.preventDefault(); send(input) }}
            className="flex items-end gap-2"
          >
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(input) }
              }}
              rows={1}
              placeholder="Ask about your store…"
              className="flex-1 resize-none bg-surface-900 border border-surface-600 rounded-xl px-3.5 py-2.5
                         text-white text-sm focus:outline-none focus:border-primary-500 max-h-32"
            />
            <button
              type="submit"
              disabled={!input.trim() || mut.isPending}
              className="shrink-0 w-10 h-10 flex items-center justify-center rounded-xl bg-primary-600
                         hover:bg-primary-700 disabled:opacity-40 text-white transition-colors"
              title="Send"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14M12 5l7 7-7 7" />
              </svg>
            </button>
          </form>
          <p className="text-surface-500 text-[11px] text-center mt-2">
            AI can make mistakes — verify important figures in Reports.
          </p>
        </div>
      </div>
    </>
  )
}

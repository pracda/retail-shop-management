import { useEffect, useRef, useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { askCashier, type ChatMessage } from '../../services/assistantService'

const QUICK = [
  "How many Coke 12 oz left?",
  "What's the price of it?",
  "Total sales today?",
]

function extractError(e: unknown): string {
  const err = e as { response?: { status?: number; data?: { error?: { message?: string } } } }
  return err?.response?.data?.error?.message
    ?? (err?.response?.status === 503
      ? 'The AI assistant is not enabled yet.'
      : 'Something went wrong. Try again.')
}

export default function PosAssistantModal({ onClose }: { onClose: () => void }) {
  const [input, setInput] = useState('')
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const scrollRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const mut = useMutation({
    mutationFn: (message: string) => askCashier({ message, history: messages.slice(-4) }),
    onSuccess: (res) => setMessages((m) => [...m, { role: 'assistant', content: res.reply }]),
    onError: (e) => setMessages((m) => [...m, { role: 'assistant', content: `⚠️ ${extractError(e)}` }]),
  })

  useEffect(() => { inputRef.current?.focus() }, [])
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages, mut.isPending])
  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  function send(text: string) {
    const message = text.trim()
    if (!message || mut.isPending) return
    setMessages((m) => [...m, { role: 'user', content: message }])
    setInput('')
    mut.mutate(message)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      <div className="relative w-full max-w-lg bg-surface-800 border border-surface-700 rounded-2xl
                      shadow-2xl flex flex-col max-h-[80vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-surface-700 shrink-0">
          <h2 className="text-white font-semibold flex items-center gap-2">
            <svg className="w-5 h-5 text-primary-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
              <path strokeLinecap="round" strokeLinejoin="round"
                d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-4 4v-4z" />
            </svg>
            Quick Assistant
          </h2>
          <button onClick={onClose} className="text-surface-400 hover:text-white p-1 rounded-lg hover:bg-surface-700">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Messages */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-3 min-h-[8rem]">
          {messages.length === 0 && (
            <div className="pt-2">
              <p className="text-surface-300 text-sm mb-3 text-center">
                Quick stock, price and sales lookups.
              </p>
              <div className="flex flex-wrap gap-2 justify-center">
                {QUICK.map((q) => (
                  <button
                    key={q}
                    onClick={() => send(q)}
                    className="px-3 py-1.5 rounded-full bg-surface-900 border border-surface-700
                               text-surface-200 text-xs hover:border-primary-600 hover:text-white transition-colors"
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((m, i) => (
            <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div
                className={`max-w-[85%] px-4 py-2.5 rounded-2xl whitespace-pre-wrap leading-relaxed
                  ${m.role === 'user'
                    ? 'bg-primary-600 text-white text-sm rounded-br-sm'
                    : 'bg-surface-900 border border-surface-700 text-surface-50 text-base font-medium rounded-bl-sm'
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

        {/* Input — scanner/keyboard friendly */}
        <div className="border-t border-surface-700 p-3 shrink-0">
          <form onSubmit={(e) => { e.preventDefault(); send(input) }} className="flex gap-2">
            <input
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask stock, price, or today's total…"
              className="flex-1 bg-surface-900 border border-surface-600 rounded-xl px-4 py-3
                         text-white text-base focus:outline-none focus:border-primary-500"
            />
            <button
              type="submit"
              disabled={!input.trim() || mut.isPending}
              className="shrink-0 px-5 rounded-xl bg-primary-600 hover:bg-primary-700 disabled:opacity-40
                         text-white font-semibold transition-colors"
            >
              Ask
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}

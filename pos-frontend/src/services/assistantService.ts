import api from './api'

// ── Types ──────────────────────────────────────────────────────────────────────

export interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

export interface AssistantChatResponse {
  reply: string
  model?: string
  requestId?: string
  promptTokens?: number
  completionTokens?: number
  totalTokens?: number
}

interface ChatPayload {
  message: string
  history?: ChatMessage[]
}

// ── API calls ──────────────────────────────────────────────────────────────────

/** Analytical assistant for back-office (admin/manager) users. */
export async function askAdmin(payload: ChatPayload): Promise<AssistantChatResponse> {
  const { data } = await api.post('/assistant/chat', payload)
  return data.data
}

/** Narrow product/sales lookup assistant for cashiers at the POS. */
export async function askCashier(payload: ChatPayload): Promise<AssistantChatResponse> {
  const { data } = await api.post('/assistant/pos-chat', payload)
  return data.data
}

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

// ── Per-store configuration (admin) ──────────────────────────────────────────

export interface AssistantConfig {
  gatewayConfigured: boolean   // server has a gateway URL
  storeKeyConfigured: boolean  // this store has its own key
  usingServerDefault: boolean  // falling back to the server default key
  keyPreview: string | null    // masked store key, e.g. "gw_live_v2…_psk"
  source: 'store' | 'default' | 'none'
}

export async function getAssistantConfig(storeId: number): Promise<AssistantConfig> {
  const { data } = await api.get('/assistant/config', { params: { storeId } })
  return data.data
}

/** Set (non-empty) or clear (empty string) this store's gateway API key. */
export async function updateAssistantKey(storeId: number, apiKey: string): Promise<AssistantConfig> {
  const { data } = await api.put('/assistant/config', { apiKey }, { params: { storeId } })
  return data.data
}

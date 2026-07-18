package com.mart.module.assistant.gateway.dto;

import java.util.List;

/**
 * Request body for the gateway's {@code POST /api/v1/chat}. Mirrors the gateway's
 * published contract: text-only (no tool definitions). {@code systemPrompt} is capped at
 * 2000 chars and {@code userMessage} at 8000 chars by the gateway.
 */
public record GatewayChatRequest(
        String provider,
        String model,
        String systemPrompt,
        String userMessage,
        List<GatewayHistoryEntry> history
) {}

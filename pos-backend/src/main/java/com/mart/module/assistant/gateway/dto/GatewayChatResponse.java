package com.mart.module.assistant.gateway.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;

/**
 * Response from the gateway's {@code POST /api/v1/chat}. Extra fields the gateway may add
 * are ignored so the client stays forward-compatible.
 */
@JsonIgnoreProperties(ignoreUnknown = true)
public record GatewayChatResponse(
        String requestId,
        String content,
        String provider,
        String model,
        GatewayTokenUsage usage,
        Long latencyMs,
        Boolean outputSanitised,
        Boolean fellBack
) {}

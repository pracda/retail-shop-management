package com.mart.module.assistant.dto;

/**
 * Answer returned to the frontend. {@code reply} is the natural-language answer;
 * token counts come straight from the gateway for cost/debug visibility.
 */
public record AssistantChatResponse(
        String reply,
        String model,
        String requestId,
        Integer promptTokens,
        Integer completionTokens,
        Integer totalTokens
) {}

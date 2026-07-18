package com.mart.module.assistant.gateway.dto;

/** Token accounting returned by the gateway, used for audit/cost visibility. */
public record GatewayTokenUsage(
        Integer promptTokens,
        Integer completionTokens,
        Integer totalTokens
) {}

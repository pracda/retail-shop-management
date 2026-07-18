package com.mart.module.assistant.gateway.dto;

/** One prior turn sent to the gateway. {@code role} is "user" or "assistant". */
public record GatewayHistoryEntry(String role, String content) {}

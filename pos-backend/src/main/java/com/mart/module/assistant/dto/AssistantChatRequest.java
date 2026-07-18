package com.mart.module.assistant.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

import java.util.List;

/**
 * Request to an assistant endpoint. {@code message} is the new user question;
 * {@code history} is the prior turns (optional, trimmed server-side).
 */
public record AssistantChatRequest(
        @NotBlank @Size(max = 2000) String message,
        @Valid @Size(max = 20) List<ChatMessage> history
) {}

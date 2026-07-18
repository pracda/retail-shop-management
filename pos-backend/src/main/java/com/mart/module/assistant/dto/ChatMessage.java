package com.mart.module.assistant.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/** A single conversation turn from the client. {@code role} is "user" or "assistant". */
public record ChatMessage(
        @NotBlank String role,
        @NotBlank @Size(max = 8000) String content
) {}

package com.mart.module.assistant.dto;

import jakarta.validation.constraints.Size;

/**
 * Sets (or clears) a store's assistant gateway API key. A null/blank {@code apiKey} clears it,
 * reverting the store to the server default.
 */
public record UpdateAssistantKeyRequest(
        @Size(max = 255, message = "API key must be 255 characters or fewer") String apiKey
) {}

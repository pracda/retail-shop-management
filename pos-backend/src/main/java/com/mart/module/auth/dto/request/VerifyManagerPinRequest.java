package com.mart.module.auth.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

public record VerifyManagerPinRequest(
        @NotNull Long storeId,
        @NotBlank String pin
) {}

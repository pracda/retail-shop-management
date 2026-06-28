package com.mart.module.shift.dto.request;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotNull;

import java.math.BigDecimal;

/**
 * Shifts are now store-level — one open shift per store at a time.
 * The authenticated user opening the shift is recorded as both cashier and openedBy.
 */
public record OpenShiftRequest(
        @NotNull Long storeId,
        @DecimalMin("0.00") BigDecimal openingFloat
) {}

package com.mart.module.shift.dto.request;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotNull;

import java.math.BigDecimal;

public record CloseShiftRequest(
        @NotNull Long storeId,
        @DecimalMin("0.00") BigDecimal closingCash,
        String notes
) {}

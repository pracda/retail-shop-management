package com.mart.module.expense.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

import java.math.BigDecimal;

public record CreateExpenseRequest(
        @NotNull Long storeId,
        @NotNull Long shiftId,
        @NotBlank String description,
        @NotNull BigDecimal amount,
        String category
) {}

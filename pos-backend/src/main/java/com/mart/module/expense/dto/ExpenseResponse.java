package com.mart.module.expense.dto;

import com.mart.module.expense.entity.ShiftExpense;

import java.math.BigDecimal;
import java.time.Instant;

public record ExpenseResponse(
        Long id,
        Long storeId,
        Long shiftId,
        String recordedByName,
        String description,
        BigDecimal amount,
        String category,
        Instant createdAt
) {
    public static ExpenseResponse from(ShiftExpense e) {
        return new ExpenseResponse(
                e.getId(),
                e.getStore().getId(),
                e.getShift().getId(),
                e.getRecordedBy().getFirstName() + " " + e.getRecordedBy().getLastName(),
                e.getDescription(),
                e.getAmount(),
                e.getCategory(),
                e.getCreatedAt()
        );
    }
}

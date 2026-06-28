package com.mart.module.shift.dto.response;

import com.mart.module.shift.entity.Shift;
import com.mart.module.shift.entity.ShiftStatus;

import java.math.BigDecimal;
import java.time.Instant;

public record ShiftResponse(
        Long id,
        Long storeId,
        String storeName,
        Long cashierId,
        String cashierName,
        Long openedById,
        String openedByName,
        Long closedById,
        String closedByName,
        ShiftStatus status,
        BigDecimal openingFloat,
        BigDecimal closingCash,
        BigDecimal expenseTotal,
        String notes,
        Instant openedAt,
        Instant closedAt,
        Instant createdAt
) {
    public static ShiftResponse from(Shift s) {
        return from(s, BigDecimal.ZERO);
    }

    public static ShiftResponse from(Shift s, BigDecimal expenseTotal) {
        return new ShiftResponse(
                s.getId(),
                s.getStore().getId(),
                s.getStore().getName(),
                s.getCashier().getId(),
                s.getCashier().getFirstName() + " " + s.getCashier().getLastName(),
                s.getOpenedBy().getId(),
                s.getOpenedBy().getFirstName() + " " + s.getOpenedBy().getLastName(),
                s.getClosedBy() != null ? s.getClosedBy().getId() : null,
                s.getClosedBy() != null ? s.getClosedBy().getFirstName() + " " + s.getClosedBy().getLastName() : null,
                s.getStatus(),
                s.getOpeningFloat(),
                s.getClosingCash(),
                expenseTotal,
                s.getNotes(),
                s.getOpenedAt(),
                s.getClosedAt(),
                s.getCreatedAt()
        );
    }
}

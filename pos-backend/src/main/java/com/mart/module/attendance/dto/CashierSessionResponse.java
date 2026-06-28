package com.mart.module.attendance.dto;

import com.mart.module.attendance.entity.CashierSession;

import java.time.Instant;

public record CashierSessionResponse(
        Long id,
        Long storeId,
        Long cashierId,
        String cashierName,
        Instant clockedInAt,
        Instant clockedOutAt,
        String notes,
        boolean active
) {
    public static CashierSessionResponse from(CashierSession s) {
        return new CashierSessionResponse(
                s.getId(),
                s.getStore().getId(),
                s.getCashier().getId(),
                s.getCashier().getFirstName() + " " + s.getCashier().getLastName(),
                s.getClockedInAt(),
                s.getClockedOutAt(),
                s.getNotes(),
                s.isActive()
        );
    }
}

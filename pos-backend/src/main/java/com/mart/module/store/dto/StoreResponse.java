package com.mart.module.store.dto;

import com.mart.module.store.entity.Store;

import java.math.BigDecimal;

public record StoreResponse(
        Long id,
        String name,
        String address,
        String phone,
        String email,
        Boolean isActive,
        BigDecimal taxRate
) {
    public static StoreResponse from(Store s) {
        return new StoreResponse(
                s.getId(), s.getName(), s.getAddress(), s.getPhone(), s.getEmail(),
                s.getIsActive(),
                s.getTaxRate() != null ? s.getTaxRate() : BigDecimal.ZERO
        );
    }
}

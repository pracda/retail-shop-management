package com.mart.module.supplier.dto;

import com.mart.module.supplier.entity.Supplier;

import java.time.Instant;

public record SupplierResponse(
        Long id,
        Long storeId,
        String name,
        String contactName,
        String phone,
        String email,
        String address,
        String notes,
        Boolean isActive,
        Instant createdAt
) {
    public static SupplierResponse from(Supplier s) {
        return new SupplierResponse(
                s.getId(),
                s.getStore().getId(),
                s.getName(),
                s.getContactName(),
                s.getPhone(),
                s.getEmail(),
                s.getAddress(),
                s.getNotes(),
                s.getIsActive(),
                s.getCreatedAt()
        );
    }
}

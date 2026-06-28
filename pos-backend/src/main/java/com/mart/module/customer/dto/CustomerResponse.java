package com.mart.module.customer.dto;

import com.mart.module.customer.entity.Customer;

import java.math.BigDecimal;
import java.time.Instant;

public record CustomerResponse(
        Long id,
        Long storeId,
        String name,
        String phone,
        String email,
        String address,
        Integer loyaltyPoints,
        BigDecimal totalSpent,
        String notes,
        Boolean isActive,
        Instant createdAt
) {
    public static CustomerResponse from(Customer c) {
        return new CustomerResponse(
                c.getId(),
                c.getStore().getId(),
                c.getName(),
                c.getPhone(),
                c.getEmail(),
                c.getAddress(),
                c.getLoyaltyPoints(),
                c.getTotalSpent(),
                c.getNotes(),
                c.getIsActive(),
                c.getCreatedAt()
        );
    }
}

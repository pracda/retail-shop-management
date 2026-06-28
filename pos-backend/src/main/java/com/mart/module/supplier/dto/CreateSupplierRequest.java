package com.mart.module.supplier.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

public record CreateSupplierRequest(
        @NotNull Long storeId,
        @NotBlank String name,
        String contactName,
        String phone,
        String email,
        String address,
        String notes
) {}

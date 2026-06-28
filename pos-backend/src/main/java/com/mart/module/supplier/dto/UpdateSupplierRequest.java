package com.mart.module.supplier.dto;

import jakarta.validation.constraints.NotBlank;

public record UpdateSupplierRequest(
        @NotBlank String name,
        String contactName,
        String phone,
        String email,
        String address,
        String notes
) {}

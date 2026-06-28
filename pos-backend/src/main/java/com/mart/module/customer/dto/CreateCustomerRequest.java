package com.mart.module.customer.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

public record CreateCustomerRequest(
        @NotNull Long storeId,
        @NotBlank String name,
        String phone,
        String email,
        String address,
        String notes
) {}

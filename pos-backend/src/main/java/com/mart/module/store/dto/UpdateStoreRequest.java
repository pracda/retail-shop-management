package com.mart.module.store.dto;

import jakarta.validation.constraints.*;

import java.math.BigDecimal;

public record UpdateStoreRequest(
        @NotBlank @Size(max = 100) String name,
        @Size(max = 255) String address,
        @Size(max = 20) String phone,
        @Email @Size(max = 100) String email,
        @DecimalMin("0.0000") @DecimalMax("1.0000") BigDecimal taxRate
) {}

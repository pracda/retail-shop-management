package com.mart.module.sale.dto.request;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotNull;

import java.math.BigDecimal;

public record SaleItemRequest(
        /** Null for manual items — must provide manualDescription + manualUnitPrice instead. */
        Long productId,

        @NotNull @DecimalMin("0.001") BigDecimal quantity,

        @DecimalMin("0.00") BigDecimal discountAmount,

        /** Required when productId is null. */
        String manualDescription,

        /** Required when productId is null. Must be > 0. */
        @DecimalMin("0.01") BigDecimal manualUnitPrice
) {}

package com.mart.module.inventory.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Getter;
import lombok.Setter;

import java.math.BigDecimal;

@Getter
@Setter
public class AdjustStockRequest {

    @NotNull(message = "Store ID is required")
    private Long storeId;

    @NotNull(message = "Product ID is required")
    private Long productId;

    /**
     * New absolute quantity (in base units).
     * The service will calculate the delta and record it as an ADJUSTMENT movement.
     */
    @NotNull(message = "New quantity is required")
    private BigDecimal newQuantity;

    @NotBlank(message = "Adjustment reason is required")
    private String note;
}

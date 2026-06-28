package com.mart.module.inventory.dto.request;

import com.mart.module.product.entity.ProductUnit;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotNull;
import lombok.Getter;
import lombok.Setter;

import java.math.BigDecimal;

@Getter
@Setter
public class ReceiveStockRequest {

    @NotNull(message = "Store ID is required")
    private Long storeId;

    @NotNull(message = "Product ID is required")
    private Long productId;

    @NotNull(message = "Quantity is required")
    @DecimalMin(value = "0.001", message = "Quantity must be greater than zero")
    private BigDecimal quantity;

    /**
     * Unit the quantity is expressed in. Converted to base units automatically.
     * Defaults to the product's base unit if omitted.
     */
    private ProductUnit receivedUnit;

    private String note;
}

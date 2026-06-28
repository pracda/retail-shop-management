package com.mart.module.product.dto.request;

import com.mart.module.product.entity.ProductUnit;
import jakarta.validation.constraints.*;
import lombok.Getter;
import lombok.Setter;

import java.math.BigDecimal;

@Getter
@Setter
public class UpdateProductRequest {

    private Long categoryId;

    @NotBlank(message = "Product name is required")
    @Size(max = 150, message = "Name must be 150 characters or fewer")
    private String name;

    private String description;

    @Size(max = 50, message = "Barcode must be 50 characters or fewer")
    private String barcode;

    @Size(max = 50, message = "SKU must be 50 characters or fewer")
    private String sku;

    private ProductUnit baseUnit;

    @Min(value = 1, message = "Units per pack must be at least 1")
    private Integer unitsPerPack;

    @Min(value = 1, message = "Packs per carton must be at least 1")
    private Integer packsPerCarton;

    @NotNull(message = "Cost price is required")
    @DecimalMin(value = "0.00", message = "Cost price cannot be negative")
    private BigDecimal costPrice;

    @NotNull(message = "Selling price is required")
    @DecimalMin(value = "0.01", message = "Selling price must be greater than zero")
    private BigDecimal sellingPrice;

    @Min(value = 0, message = "Low stock threshold cannot be negative")
    private Integer lowStockThreshold;

    @Min(value = 0, message = "Loyalty multiplier cannot be negative")
    private Integer loyaltyMultiplier;

    private java.math.BigDecimal taxRate;

    private Boolean isTaxable;

    private Long parentProductId;

    private String variantName;
}

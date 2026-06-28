package com.mart.module.product.dto.response;

import com.mart.module.product.entity.ProductUnit;
import lombok.Builder;
import lombok.Getter;

import java.math.BigDecimal;
import java.time.Instant;

@Getter
@Builder
public class ProductResponse {
    private Long id;
    private Long storeId;
    private String storeName;
    private Long categoryId;
    private String categoryName;
    private String name;
    private String description;
    private String barcode;
    private String sku;
    private ProductUnit baseUnit;
    private Integer unitsPerPack;
    private Integer packsPerCarton;
    private Integer loyaltyMultiplier;
    private BigDecimal costPrice;
    private BigDecimal sellingPrice;
    private Integer lowStockThreshold;
    private Boolean isActive;
    private BigDecimal taxRate;
    private Boolean isTaxable;
    private Long parentProductId;
    private String variantName;
    private Integer variantCount;
    private BigDecimal currentStock;
    private Instant createdAt;
    private Instant updatedAt;
}

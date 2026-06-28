package com.mart.module.ecommerce.dto.response;

import lombok.Builder;
import lombok.Data;

import java.math.BigDecimal;

@Data @Builder
public class CatalogProductResponse {
    private Long id;
    private String name;
    private String description;
    private String barcode;
    private String sku;
    private Long categoryId;
    private String categoryName;
    private BigDecimal sellingPrice;
    private BigDecimal currentStock;
    private Boolean inStock;
    private Integer variantCount;
    private Long parentProductId;
    private String variantName;
    private Boolean isTaxable;
    private BigDecimal taxRate;
}

package com.mart.module.inventory.dto.response;

import lombok.Builder;
import lombok.Getter;

import java.math.BigDecimal;
import java.time.Instant;

@Getter
@Builder
public class StockBalanceResponse {
    private Long id;
    private Long storeId;
    private Long productId;
    private String productName;
    private String productBarcode;
    private String categoryName;
    private BigDecimal quantity;
    private Integer lowStockThreshold;
    private boolean isLowStock;
    private Instant updatedAt;
}

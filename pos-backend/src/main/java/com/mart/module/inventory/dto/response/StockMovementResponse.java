package com.mart.module.inventory.dto.response;

import com.mart.module.inventory.entity.MovementType;
import lombok.Builder;
import lombok.Getter;

import java.math.BigDecimal;
import java.time.Instant;

@Getter
@Builder
public class StockMovementResponse {
    private Long id;
    private Long storeId;
    private Long productId;
    private String productName;
    private MovementType movementType;
    private BigDecimal quantity;
    private BigDecimal quantityBefore;
    private BigDecimal quantityAfter;
    private Long referenceId;
    private String note;
    private Instant createdAt;
    private Long createdBy;
}

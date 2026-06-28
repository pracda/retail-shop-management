package com.mart.module.purchaseorder.dto;

import java.math.BigDecimal;

public record PurchaseOrderItemRequest(
        Long productId,
        BigDecimal quantityOrdered,
        BigDecimal unitCost
) {}

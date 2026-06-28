package com.mart.module.purchaseorder.dto;

import com.mart.module.purchaseorder.entity.PurchaseOrderItem;

import java.math.BigDecimal;

public record PurchaseOrderItemResponse(
        Long id,
        Long productId,
        String productName,
        BigDecimal quantityOrdered,
        BigDecimal quantityReceived,
        BigDecimal unitCost
) {
    public static PurchaseOrderItemResponse from(PurchaseOrderItem item) {
        return new PurchaseOrderItemResponse(
                item.getId(),
                item.getProduct().getId(),
                item.getProduct().getName(),
                item.getQuantityOrdered(),
                item.getQuantityReceived(),
                item.getUnitCost()
        );
    }
}

package com.mart.module.refund.dto;

import com.mart.module.refund.entity.RefundItem;

import java.math.BigDecimal;

public record RefundItemResponse(
        Long id,
        Long saleItemId,
        String productName,
        BigDecimal quantity,
        BigDecimal refundAmount
) {
    public static RefundItemResponse from(RefundItem item) {
        String name = item.getSaleItem().getProduct() != null
                ? item.getSaleItem().getProduct().getName()
                : item.getSaleItem().getManualDescription();
        return new RefundItemResponse(
                item.getId(),
                item.getSaleItem().getId(),
                name,
                item.getQuantity(),
                item.getRefundAmount()
        );
    }
}

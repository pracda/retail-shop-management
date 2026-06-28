package com.mart.module.purchaseorder.dto;

import com.mart.module.purchaseorder.entity.PurchaseOrder;
import com.mart.module.purchaseorder.entity.PurchaseOrderStatus;

import java.time.Instant;
import java.util.List;

public record PurchaseOrderResponse(
        Long id,
        Long storeId,
        Long supplierId,
        String supplierName,
        String poNumber,
        PurchaseOrderStatus status,
        String notes,
        Instant orderedAt,
        Instant receivedAt,
        Instant createdAt,
        List<PurchaseOrderItemResponse> items
) {
    public static PurchaseOrderResponse from(PurchaseOrder po) {
        return new PurchaseOrderResponse(
                po.getId(),
                po.getStore().getId(),
                po.getSupplier().getId(),
                po.getSupplier().getName(),
                po.getPoNumber(),
                po.getStatus(),
                po.getNotes(),
                po.getOrderedAt(),
                po.getReceivedAt(),
                po.getCreatedAt(),
                po.getItems().stream().map(PurchaseOrderItemResponse::from).toList()
        );
    }
}

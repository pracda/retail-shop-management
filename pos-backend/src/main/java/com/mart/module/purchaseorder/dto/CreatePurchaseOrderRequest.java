package com.mart.module.purchaseorder.dto;

import jakarta.validation.constraints.NotNull;

import java.util.List;

public record CreatePurchaseOrderRequest(
        @NotNull Long storeId,
        @NotNull Long supplierId,
        String notes,
        List<PurchaseOrderItemRequest> items
) {}

package com.mart.module.purchaseorder.dto;

import java.util.List;

public record ReceiveItemsRequest(
        List<ReceiveLineRequest> lines
) {
    public record ReceiveLineRequest(
            Long poItemId,
            java.math.BigDecimal quantityReceived
    ) {}
}

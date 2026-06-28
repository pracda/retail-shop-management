package com.mart.module.refund.dto;

import java.math.BigDecimal;

public record RefundItemRequest(
        Long saleItemId,
        BigDecimal quantity
) {}

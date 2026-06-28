package com.mart.module.refund.dto;

import jakarta.validation.constraints.NotNull;

import java.util.List;

public record CreateRefundRequest(
        @NotNull Long saleId,
        String reason,
        String refundMethod,
        List<RefundItemRequest> items
) {}

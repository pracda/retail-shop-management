package com.mart.module.refund.dto;

import com.mart.module.refund.entity.Refund;
import com.mart.module.refund.entity.RefundStatus;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;

public record RefundResponse(
        Long id,
        Long saleId,
        String receiptNumber,
        String refundedByName,
        String reason,
        BigDecimal refundAmount,
        String refundMethod,
        RefundStatus status,
        String approvedByName,
        Instant approvedAt,
        String rejectionReason,
        Instant createdAt,
        List<RefundItemResponse> items
) {
    public static RefundResponse from(Refund r) {
        return new RefundResponse(
                r.getId(),
                r.getSale().getId(),
                r.getSale().getReceiptNumber(),
                r.getRefundedBy().getFirstName() + " " + r.getRefundedBy().getLastName(),
                r.getReason(),
                r.getRefundAmount(),
                r.getRefundMethod(),
                r.getStatus(),
                r.getApprovedBy() != null
                        ? r.getApprovedBy().getFirstName() + " " + r.getApprovedBy().getLastName()
                        : null,
                r.getApprovedAt(),
                r.getRejectionReason(),
                r.getCreatedAt(),
                r.getItems().stream().map(RefundItemResponse::from).toList()
        );
    }
}

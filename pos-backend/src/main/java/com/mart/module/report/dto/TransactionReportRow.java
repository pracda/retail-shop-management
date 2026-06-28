package com.mart.module.report.dto;

import java.math.BigDecimal;
import java.time.Instant;

public record TransactionReportRow(
        Long saleId,
        String receiptNumber,
        Instant createdAt,
        String cashierName,
        String paymentMethod,
        int itemCount,
        BigDecimal subtotal,
        BigDecimal discountAmount,
        BigDecimal totalAmount,
        String status
) {}

package com.mart.module.sale.dto.response;

import com.mart.module.sale.entity.PaymentMethod;
import com.mart.module.sale.entity.Sale;
import com.mart.module.sale.entity.SaleStatus;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;

public record SaleResponse(
        Long id,
        Long storeId,
        Long shiftId,
        Long cashierId,
        String cashierName,
        String receiptNumber,
        SaleStatus status,
        BigDecimal subtotal,
        BigDecimal discountAmount,
        BigDecimal taxAmount,
        BigDecimal totalAmount,
        BigDecimal amountTendered,
        BigDecimal changeDue,
        PaymentMethod paymentMethod,
        String notes,
        Integer loyaltyPointsRedeemed,
        Integer pointsEarned,
        Long customerId,
        String customerName,
        Long voidedById,
        String voidReason,
        Instant voidedAt,
        List<SaleItemResponse> items,
        List<SalePaymentResponse> payments,
        Instant createdAt
) {
    public record SalePaymentResponse(PaymentMethod paymentMethod, BigDecimal amount) {}

    public static SaleResponse from(Sale s) {
        return new SaleResponse(
                s.getId(),
                s.getStore().getId(),
                s.getShift().getId(),
                s.getCashier().getId(),
                s.getCashier().getFirstName() + " " + s.getCashier().getLastName(),
                s.getReceiptNumber(),
                s.getStatus(),
                s.getSubtotal(),
                s.getDiscountAmount(),
                s.getTaxAmount(),
                s.getTotalAmount(),
                s.getAmountTendered(),
                s.getChangeDue(),
                s.getPaymentMethod(),
                s.getNotes(),
                s.getLoyaltyPointsRedeemed(),
                s.getPointsEarned(),
                s.getCustomer() != null ? s.getCustomer().getId() : null,
                s.getCustomer() != null ? s.getCustomer().getName() : null,
                s.getVoidedBy() != null ? s.getVoidedBy().getId() : null,
                s.getVoidReason(),
                s.getVoidedAt(),
                s.getItems().stream().map(SaleItemResponse::from).toList(),
                s.getPayments().stream()
                        .map(p -> new SalePaymentResponse(p.getPaymentMethod(), p.getAmount()))
                        .toList(),
                s.getCreatedAt()
        );
    }
}

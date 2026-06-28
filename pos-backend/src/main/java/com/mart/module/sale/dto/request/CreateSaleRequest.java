package com.mart.module.sale.dto.request;

import com.mart.module.sale.entity.PaymentMethod;
import jakarta.validation.Valid;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;

import java.math.BigDecimal;
import java.util.List;

public record CreateSaleRequest(
        @NotNull Long storeId,
        @NotNull Long shiftId,
        @NotEmpty @Valid List<SaleItemRequest> items,
        @NotNull PaymentMethod paymentMethod,
        @NotNull @DecimalMin("0.00") BigDecimal amountTendered,
        @DecimalMin("0.00") BigDecimal discountAmount,
        String notes,
        Long customerId,
        List<SalePaymentRequest> payments,
        Integer loyaltyPointsRedeemed
) {}

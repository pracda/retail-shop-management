package com.mart.module.ecommerce.dto.response;

import lombok.Builder;
import lombok.Data;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;

@Data @Builder
public class OnlineOrderResponse {
    private Long id;
    private String orderNumber;
    private String status;
    private BigDecimal subtotal;
    private BigDecimal discountAmount;
    private BigDecimal totalAmount;
    private Integer loyaltyPointsUsed;
    private Integer loyaltyPointsEarned;
    private String deliveryAddress;
    private String note;
    private Instant placedAt;
    private Instant confirmedAt;
    private Instant fulfilledAt;
    private Instant cancelledAt;
    private String cancelReason;
    private List<OrderItemResponse> items;

    // populated by admin endpoints only
    private String customerName;
    private String customerEmail;

    @Data @Builder
    public static class OrderItemResponse {
        private Long productId;
        private String productName;
        private BigDecimal unitPrice;
        private Integer quantity;
        private BigDecimal lineTotal;
    }
}

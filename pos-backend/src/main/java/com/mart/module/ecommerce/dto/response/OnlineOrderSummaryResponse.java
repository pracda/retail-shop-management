package com.mart.module.ecommerce.dto.response;

import lombok.Builder;
import lombok.Data;

import java.math.BigDecimal;

@Data @Builder
public class OnlineOrderSummaryResponse {
    private long totalOrders;
    private long pendingCount;
    private long confirmedCount;
    private long fulfilledCount;
    private long cancelledCount;
    private BigDecimal totalRevenue;
    private BigDecimal avgOrderValue;
}

package com.mart.module.ecommerce.dto.response;

import lombok.Builder;
import lombok.Data;

import java.math.BigDecimal;

@Data @Builder
public class OnlineOrderDailyRow {
    private String date;
    private long orderCount;
    private BigDecimal revenue;
}

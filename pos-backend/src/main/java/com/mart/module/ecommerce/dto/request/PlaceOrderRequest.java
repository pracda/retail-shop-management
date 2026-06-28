package com.mart.module.ecommerce.dto.request;

import jakarta.validation.constraints.Size;
import lombok.Data;

@Data
public class PlaceOrderRequest {

    @Size(max = 500)
    private String deliveryAddress;

    @Size(max = 500)
    private String note;

    /** Optional: redeem loyalty points toward the order total */
    private Integer loyaltyPointsToRedeem;
}

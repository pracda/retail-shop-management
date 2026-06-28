package com.mart.module.ecommerce.dto.response;

import lombok.Builder;
import lombok.Data;

@Data @Builder
public class CustomerAuthResponse {
    private String accessToken;
    private String refreshToken;
    private CustomerProfileResponse customer;
}

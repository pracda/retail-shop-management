package com.mart.module.ecommerce.dto.response;

import lombok.Builder;
import lombok.Data;

import java.time.Instant;

@Data @Builder
public class CustomerProfileResponse {
    private Long id;
    private Long storeId;
    private String storeName;
    private String email;
    private String firstName;
    private String lastName;
    private String phone;
    private String address;
    private Boolean emailVerified;
    private Integer loyaltyPoints;
    private Boolean isActive;
    private Instant createdAt;
}

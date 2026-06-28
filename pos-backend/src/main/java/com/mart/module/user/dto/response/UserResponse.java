package com.mart.module.user.dto.response;

import lombok.Builder;
import lombok.Getter;

import java.time.Instant;

@Getter
@Builder
public class UserResponse {

    private final Long id;
    private final String firstName;
    private final String lastName;
    private final String email;
    private final String phone;
    private final String role;
    private final Long roleId;
    private final Long storeId;
    private final String storeName;
    private final Boolean isActive;
    private final Instant lastLoginAt;
    private final Instant createdAt;
}
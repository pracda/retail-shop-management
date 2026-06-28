package com.mart.module.category.dto.response;

import lombok.Builder;
import lombok.Getter;

import java.time.Instant;

@Getter
@Builder
public class CategoryResponse {
    private Long id;
    private Long storeId;
    private String storeName;
    private String name;
    private String description;
    private Boolean isActive;
    private Instant createdAt;
}

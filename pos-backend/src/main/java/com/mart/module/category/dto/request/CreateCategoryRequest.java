package com.mart.module.category.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class CreateCategoryRequest {

    @NotNull(message = "Store ID is required")
    private Long storeId;

    @NotBlank(message = "Category name is required")
    @Size(max = 100, message = "Name must be 100 characters or fewer")
    private String name;

    @Size(max = 255, message = "Description must be 255 characters or fewer")
    private String description;
}

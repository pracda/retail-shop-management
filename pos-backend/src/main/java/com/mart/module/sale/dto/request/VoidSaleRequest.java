package com.mart.module.sale.dto.request;

import jakarta.validation.constraints.NotBlank;

public record VoidSaleRequest(@NotBlank String reason) {}

package com.mart.module.refund.dto;

import jakarta.validation.constraints.NotBlank;

public record RejectRefundRequest(@NotBlank String reason) {}

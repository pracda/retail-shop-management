package com.mart.module.attendance.dto;

import jakarta.validation.constraints.NotNull;

public record ClockInRequest(
        @NotNull Long storeId
) {}

package com.mart.module.attendance.dto;

import jakarta.validation.constraints.NotNull;

import java.time.Instant;

public record UpdateSessionRequest(
        @NotNull Instant clockedInAt,
        Instant clockedOutAt,   // null means session is still active
        String notes
) {}

package com.mart.module.auth.dto.response;

public record ManagerApprovalResponse(
        boolean approved,
        String approverName
) {}

package com.mart.module.audit.dto;

import com.mart.module.audit.entity.AuditLog;

import java.time.Instant;

public record AuditLogResponse(
        Long id,
        Long storeId,
        Long userId,
        String userName,
        String action,
        String entityType,
        Long entityId,
        String details,
        Instant createdAt
) {
    public static AuditLogResponse from(AuditLog log) {
        return new AuditLogResponse(
                log.getId(),
                log.getStore().getId(),
                log.getUser() != null ? log.getUser().getId() : null,
                log.getUser() != null ? log.getUser().getFirstName() + " " + log.getUser().getLastName() : null,
                log.getAction(),
                log.getEntityType(),
                log.getEntityId(),
                log.getDetails(),
                log.getCreatedAt()
        );
    }
}

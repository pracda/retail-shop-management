package com.mart.module.audit.repository;

import com.mart.module.audit.entity.AuditLog;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

public interface AuditLogRepository extends JpaRepository<AuditLog, Long> {
    Page<AuditLog> findByStoreId(Long storeId, Pageable pageable);
    Page<AuditLog> findByStoreIdAndEntityType(Long storeId, String entityType, Pageable pageable);
}

package com.mart.module.audit.service;

import com.mart.common.response.PageResponse;
import com.mart.module.audit.dto.AuditLogResponse;
import com.mart.module.audit.entity.AuditLog;
import com.mart.module.audit.repository.AuditLogRepository;
import com.mart.module.store.entity.Store;
import com.mart.module.store.repository.StoreRepository;
import com.mart.module.user.entity.User;
import com.mart.module.user.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Slf4j
@Service
@RequiredArgsConstructor
public class AuditLogService {

    private final AuditLogRepository auditLogRepository;
    private final StoreRepository storeRepository;
    private final UserRepository userRepository;

    @Transactional
    public void log(Long storeId, String action, String entityType, Long entityId, String details) {
        try {
            Store store = storeRepository.getReferenceById(storeId);
            User user = null;
            var auth = SecurityContextHolder.getContext().getAuthentication();
            if (auth != null && auth.getPrincipal() instanceof com.mart.common.security.UserPrincipal principal) {
                user = userRepository.getReferenceById(principal.getId());
            }
            auditLogRepository.save(AuditLog.builder()
                    .store(store)
                    .user(user)
                    .action(action)
                    .entityType(entityType)
                    .entityId(entityId)
                    .details(details)
                    .build());
        } catch (Exception e) {
            // Audit logging must never break the main transaction
            log.warn("Failed to write audit log: {}", e.getMessage());
        }
    }

    @Transactional(readOnly = true)
    public PageResponse<AuditLogResponse> getLogs(Long storeId, String entityType, int page, int size) {
        var pageable = PageRequest.of(page, size, Sort.by("createdAt").descending());
        var result = entityType != null
                ? auditLogRepository.findByStoreIdAndEntityType(storeId, entityType, pageable)
                : auditLogRepository.findByStoreId(storeId, pageable);
        return PageResponse.from(result.map(AuditLogResponse::from));
    }
}

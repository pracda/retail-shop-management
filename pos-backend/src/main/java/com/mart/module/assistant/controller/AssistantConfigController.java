package com.mart.module.assistant.controller;

import com.mart.common.constant.RoleConstants;
import com.mart.common.exception.AppException;
import com.mart.common.response.ApiResponse;
import com.mart.common.security.UserPrincipal;
import com.mart.module.assistant.dto.AssistantConfigResponse;
import com.mart.module.assistant.dto.UpdateAssistantKeyRequest;
import com.mart.module.assistant.service.AssistantConfigService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

/**
 * Per-store AI assistant configuration (gateway API key), managed from the back office.
 * ADMIN can only touch their own store; MASTER_ADMIN can manage any store.
 */
@RestController
@RequestMapping("/assistant/config")
@RequiredArgsConstructor
public class AssistantConfigController {

    private final AssistantConfigService configService;

    @GetMapping
    @PreAuthorize("hasAnyRole('MASTER_ADMIN', 'ADMIN')")
    public ResponseEntity<ApiResponse<AssistantConfigResponse>> get(
            @AuthenticationPrincipal UserPrincipal principal,
            @RequestParam Long storeId) {
        authorize(principal, storeId);
        return ResponseEntity.ok(ApiResponse.success(configService.getConfig(storeId)));
    }

    @PutMapping
    @PreAuthorize("hasAnyRole('MASTER_ADMIN', 'ADMIN')")
    public ResponseEntity<ApiResponse<AssistantConfigResponse>> update(
            @AuthenticationPrincipal UserPrincipal principal,
            @RequestParam Long storeId,
            @Valid @RequestBody UpdateAssistantKeyRequest request) {
        authorize(principal, storeId);
        configService.setStoreKey(storeId, request.apiKey());
        return ResponseEntity.ok(ApiResponse.success(
                "Assistant key updated", configService.getConfig(storeId)));
    }

    /** A non-master admin may only manage the store they belong to. */
    private void authorize(UserPrincipal principal, Long storeId) {
        if (!RoleConstants.MASTER_ADMIN.equals(principal.getRole())
                && !storeId.equals(principal.getStoreId())) {
            throw AppException.forbidden("You can only manage your own store's assistant settings.");
        }
    }
}

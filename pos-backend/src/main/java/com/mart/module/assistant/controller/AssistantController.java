package com.mart.module.assistant.controller;

import com.mart.common.response.ApiResponse;
import com.mart.common.security.UserPrincipal;
import com.mart.module.assistant.dto.AssistantChatRequest;
import com.mart.module.assistant.dto.AssistantChatResponse;
import com.mart.module.assistant.service.AssistantService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * Store AI assistant endpoints. Both are JWT-authenticated and role-gated; {@code storeId} and
 * role are taken from the authenticated principal, never from the request body, which is what
 * keeps every answer scoped to the caller's own store.
 */
@RestController
@RequestMapping("/assistant")
@RequiredArgsConstructor
public class AssistantController {

    private final AssistantService assistantService;

    /** Analytical assistant for back-office users. */
    @PostMapping("/chat")
    @PreAuthorize("hasAnyRole('MASTER_ADMIN', 'ADMIN', 'MANAGER')")
    public ResponseEntity<ApiResponse<AssistantChatResponse>> chat(
            @AuthenticationPrincipal UserPrincipal principal,
            @Valid @RequestBody AssistantChatRequest request) {
        return ResponseEntity.ok(ApiResponse.success(
                assistantService.chatAdmin(principal, request)));
    }

    /** Narrow product/sales lookup assistant for cashiers at the POS terminal. */
    @PostMapping("/pos-chat")
    @PreAuthorize("hasAnyRole('MASTER_ADMIN', 'ADMIN', 'MANAGER', 'CASHIER')")
    public ResponseEntity<ApiResponse<AssistantChatResponse>> posChat(
            @AuthenticationPrincipal UserPrincipal principal,
            @Valid @RequestBody AssistantChatRequest request) {
        return ResponseEntity.ok(ApiResponse.success(
                assistantService.chatCashier(principal, request)));
    }
}

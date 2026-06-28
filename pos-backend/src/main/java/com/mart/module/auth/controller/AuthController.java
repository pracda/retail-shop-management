package com.mart.module.auth.controller;

import com.mart.common.response.ApiResponse;
import com.mart.common.security.UserPrincipal;
import com.mart.module.auth.dto.request.LoginRequest;
import com.mart.module.auth.dto.request.PinLoginRequest;
import com.mart.module.auth.dto.request.RefreshTokenRequest;
import com.mart.module.auth.dto.request.VerifyManagerPinRequest;
import com.mart.module.auth.dto.response.AuthResponse;
import com.mart.module.auth.dto.response.ManagerApprovalResponse;
import com.mart.module.auth.service.AuthService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/auth")
@RequiredArgsConstructor
public class AuthController {

    private final AuthService authService;

    @PostMapping("/login")
    public ResponseEntity<ApiResponse<AuthResponse>> login(
            @Valid @RequestBody LoginRequest request) {
        AuthResponse response = authService.login(request);
        return ResponseEntity.ok(ApiResponse.success("Login successful", response));
    }

    @PostMapping("/pin-login")
    public ResponseEntity<ApiResponse<AuthResponse>> pinLogin(
            @Valid @RequestBody PinLoginRequest request) {
        AuthResponse response = authService.pinLogin(request);
        return ResponseEntity.ok(ApiResponse.success("PIN login successful", response));
    }

    @PostMapping("/refresh")
    public ResponseEntity<ApiResponse<AuthResponse>> refresh(
            @Valid @RequestBody RefreshTokenRequest request) {
        AuthResponse response = authService.refresh(request);
        return ResponseEntity.ok(ApiResponse.success("Token refreshed", response));
    }

    /** No auth required — called from POS terminal to get manager approval for overrides. */
    @PostMapping("/verify-manager-pin")
    public ResponseEntity<ApiResponse<ManagerApprovalResponse>> verifyManagerPin(
            @Valid @RequestBody VerifyManagerPinRequest request) {
        return ResponseEntity.ok(ApiResponse.success(authService.verifyManagerPin(request)));
    }

    @PostMapping("/logout")
    public ResponseEntity<ApiResponse<Void>> logout(
            @AuthenticationPrincipal UserPrincipal principal) {
        authService.logout(principal.getId());
        return ResponseEntity.ok(ApiResponse.success("Logged out successfully", null));
    }
}
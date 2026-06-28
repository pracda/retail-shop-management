package com.mart.module.ecommerce.controller;

import com.mart.common.response.ApiResponse;
import com.mart.common.security.CustomerPrincipal;
import com.mart.module.ecommerce.dto.request.LoginRequest;
import com.mart.module.ecommerce.dto.request.RegisterRequest;
import com.mart.module.ecommerce.dto.request.UpdateProfileRequest;
import com.mart.module.ecommerce.dto.response.CustomerAuthResponse;
import com.mart.module.ecommerce.dto.response.CustomerProfileResponse;
import com.mart.module.ecommerce.service.EcommerceAuthService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/ecommerce/auth")
@RequiredArgsConstructor
public class EcommerceAuthController {

    private final EcommerceAuthService authService;

    @PostMapping("/register")
    public ResponseEntity<ApiResponse<CustomerAuthResponse>> register(
            @Valid @RequestBody RegisterRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.success("Registration successful", authService.register(request)));
    }

    @PostMapping("/login")
    public ResponseEntity<ApiResponse<CustomerAuthResponse>> login(
            @Valid @RequestBody LoginRequest request) {
        return ResponseEntity.ok(ApiResponse.success("Login successful", authService.login(request)));
    }

    @PostMapping("/refresh")
    public ResponseEntity<ApiResponse<CustomerAuthResponse>> refresh(
            @RequestBody Map<String, String> body) {
        String token = body.get("refreshToken");
        if (token == null || token.isBlank()) {
            return ResponseEntity.badRequest()
                    .body(ApiResponse.error("refreshToken is required", "REFRESH_TOKEN_REQUIRED"));
        }
        return ResponseEntity.ok(ApiResponse.success("Token refreshed", authService.refresh(token)));
    }

    @GetMapping("/profile")
    @PreAuthorize("hasRole('CUSTOMER')")
    public ResponseEntity<ApiResponse<CustomerProfileResponse>> getProfile(
            @AuthenticationPrincipal CustomerPrincipal principal) {
        return ResponseEntity.ok(ApiResponse.success(authService.getProfile(principal.getId())));
    }

    @PutMapping("/profile")
    @PreAuthorize("hasRole('CUSTOMER')")
    public ResponseEntity<ApiResponse<CustomerProfileResponse>> updateProfile(
            @AuthenticationPrincipal CustomerPrincipal principal,
            @Valid @RequestBody UpdateProfileRequest request) {
        return ResponseEntity.ok(ApiResponse.success(
                "Profile updated", authService.updateProfile(principal.getId(), request)));
    }

    @PostMapping("/logout")
    @PreAuthorize("hasRole('CUSTOMER')")
    public ResponseEntity<ApiResponse<Void>> logout(
            @AuthenticationPrincipal CustomerPrincipal principal) {
        authService.logout(principal.getId());
        return ResponseEntity.ok(ApiResponse.success("Logged out", null));
    }
}

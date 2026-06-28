package com.mart.module.auth.service;

import com.mart.common.config.JwtProperties;
import com.mart.common.exception.AppException;
import com.mart.common.security.JwtService;
import com.mart.common.security.UserPrincipal;
import com.mart.module.auth.dto.request.LoginRequest;
import com.mart.module.auth.dto.request.PinLoginRequest;
import com.mart.module.auth.dto.request.RefreshTokenRequest;
import com.mart.module.auth.dto.request.VerifyManagerPinRequest;
import com.mart.module.auth.dto.response.AuthResponse;
import com.mart.module.auth.dto.response.ManagerApprovalResponse;
import com.mart.module.auth.entity.RefreshToken;
import com.mart.module.auth.repository.RefreshTokenRepository;
import com.mart.module.user.entity.User;
import com.mart.module.user.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.Instant;
import java.util.Base64;

@Slf4j
@Service
@RequiredArgsConstructor
public class AuthService {

    private final AuthenticationManager authenticationManager;
    private final JwtService jwtService;
    private final JwtProperties jwtProperties;
    private final UserRepository userRepository;
    private final RefreshTokenRepository refreshTokenRepository;
    private final PasswordEncoder passwordEncoder;

    @Transactional
    public AuthResponse login(LoginRequest request) {
        Authentication auth = authenticationManager.authenticate(
                new UsernamePasswordAuthenticationToken(
                        request.getEmail(),
                        request.getPassword()
                )
        );

        UserPrincipal principal = (UserPrincipal) auth.getPrincipal();
        return buildAuthResponse(principal);
    }

    @Transactional
    public AuthResponse pinLogin(PinLoginRequest request) {
        // Find active cashiers in this store, match PIN
        User user = userRepository.findAll().stream()
                .filter(u -> u.getStore() != null
                        && u.getStore().getId().equals(request.getStoreId())
                        && u.getIsActive()
                        && u.getPinHash() != null
                        && passwordEncoder.matches(request.getPin(), u.getPinHash()))
                .findFirst()
                .orElseThrow(() -> AppException.unauthorized("Invalid PIN"));

        UserPrincipal principal = UserPrincipal.builder()
                .id(user.getId())
                .storeId(user.getStore().getId())
                .email(user.getEmail())
                .password(user.getPasswordHash())
                .role(user.getRole().getName())
                .active(user.getIsActive())
                .build();

        return buildAuthResponse(principal);
    }

    @Transactional
    public AuthResponse refresh(RefreshTokenRequest request) {
        String tokenHash = hashToken(request.getRefreshToken());

        RefreshToken stored = refreshTokenRepository.findByTokenHash(tokenHash)
                .orElseThrow(() -> AppException.unauthorized("Invalid refresh token"));

        if (stored.getRevoked() || stored.isExpired()) {
            throw AppException.unauthorized("Refresh token expired or revoked");
        }

        // Rotate — revoke old, issue new
        stored.setRevoked(true);
        refreshTokenRepository.save(stored);

        User user = stored.getUser();
        UserPrincipal principal = UserPrincipal.builder()
                .id(user.getId())
                .storeId(user.getStore() != null ? user.getStore().getId() : null)
                .email(user.getEmail())
                .password(user.getPasswordHash())
                .role(user.getRole().getName())
                .active(user.getIsActive())
                .build();

        return buildAuthResponse(principal);
    }

    @Transactional(readOnly = true)
    public ManagerApprovalResponse verifyManagerPin(VerifyManagerPinRequest request) {
        // Find any active MANAGER/ADMIN/MASTER_ADMIN in this store whose PIN matches
        java.util.List<String> managerRoles = java.util.List.of("MANAGER", "ADMIN", "MASTER_ADMIN");
        return userRepository.findAll().stream()
                .filter(u -> u.getStore() != null
                        && u.getStore().getId().equals(request.storeId())
                        && u.getIsActive()
                        && u.getPinHash() != null
                        && managerRoles.contains(u.getRole().getName())
                        && passwordEncoder.matches(request.pin(), u.getPinHash()))
                .findFirst()
                .map(u -> new ManagerApprovalResponse(true, u.getFirstName() + " " + u.getLastName()))
                .orElseThrow(() -> AppException.unauthorized("Invalid manager PIN"));
    }

    @Transactional
    public void logout(Long userId) {
        refreshTokenRepository.revokeAllByUserId(userId);
        log.info("User {} logged out — all refresh tokens revoked", userId);
    }

    private AuthResponse buildAuthResponse(UserPrincipal principal) {
        String accessToken  = jwtService.generateAccessToken(principal);
        String refreshToken = jwtService.generateRefreshToken(principal.getId());

        saveRefreshToken(principal.getId(), refreshToken);

        User user = userRepository.findById(principal.getId()).orElseThrow();
        user.setLastLoginAt(Instant.now());
        userRepository.save(user);

        return AuthResponse.builder()
                .accessToken(accessToken)
                .refreshToken(refreshToken)
                .tokenType("Bearer")
                .expiresIn(jwtProperties.getAccessTokenExpiryMs() / 1000)
                .user(AuthResponse.UserInfo.builder()
                        .id(user.getId())
                        .firstName(user.getFirstName())
                        .lastName(user.getLastName())
                        .email(user.getEmail())
                        .role(user.getRole().getName())
                        .storeId(user.getStore() != null ? user.getStore().getId() : null)
                        .build())
                .build();
    }
    private void saveRefreshToken(Long userId, String rawToken) {
        RefreshToken token = RefreshToken.builder()
                .user(userRepository.getReferenceById(userId))
                .tokenHash(hashToken(rawToken))
                .expiresAt(Instant.now().plusMillis(jwtProperties.getRefreshTokenExpiryMs()))
                .build();
        refreshTokenRepository.save(token);
    }

    private String hashToken(String token) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] hash = digest.digest(token.getBytes(StandardCharsets.UTF_8));
            return Base64.getEncoder().encodeToString(hash);
        } catch (NoSuchAlgorithmException e) {
            throw new RuntimeException("SHA-256 not available", e);
        }
    }
}
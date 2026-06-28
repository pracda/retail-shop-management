package com.mart.module.ecommerce.service;

import com.mart.common.exception.AppException;
import com.mart.common.security.JwtService;
import com.mart.module.ecommerce.dto.request.LoginRequest;
import com.mart.module.ecommerce.dto.request.RegisterRequest;
import com.mart.module.ecommerce.dto.request.UpdateProfileRequest;
import com.mart.module.ecommerce.dto.response.CustomerAuthResponse;
import com.mart.module.ecommerce.dto.response.CustomerProfileResponse;
import com.mart.module.ecommerce.entity.OnlineCustomer;
import com.mart.module.ecommerce.entity.OnlineCustomerRefreshToken;
import com.mart.module.ecommerce.repository.OnlineCustomerRefreshTokenRepository;
import com.mart.module.ecommerce.repository.OnlineCustomerRepository;
import com.mart.module.store.entity.Store;
import com.mart.module.store.repository.StoreRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.UUID;

@Slf4j
@Service
@RequiredArgsConstructor
public class EcommerceAuthService {

    private final OnlineCustomerRepository customerRepository;
    private final OnlineCustomerRefreshTokenRepository refreshTokenRepository;
    private final StoreRepository storeRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtService jwtService;

    @Transactional
    public CustomerAuthResponse register(RegisterRequest request) {
        Store store = storeRepository.findById(request.getStoreId())
                .orElseThrow(() -> AppException.notFound("Store not found"));

        if (customerRepository.existsByStoreIdAndEmail(store.getId(), request.getEmail().toLowerCase())) {
            throw AppException.conflict("An account with this email already exists");
        }

        OnlineCustomer customer = OnlineCustomer.builder()
                .store(store)
                .email(request.getEmail().toLowerCase().trim())
                .passwordHash(passwordEncoder.encode(request.getPassword()))
                .firstName(request.getFirstName().trim())
                .lastName(request.getLastName().trim())
                .phone(request.getPhone())
                .build();

        OnlineCustomer saved = customerRepository.save(customer);
        log.info("New online customer registered: {} (store {})", saved.getEmail(), store.getId());
        return issueTokens(saved);
    }

    @Transactional
    public CustomerAuthResponse login(LoginRequest request) {
        OnlineCustomer customer = customerRepository
                .findByStoreIdAndEmail(request.getStoreId(), request.getEmail().toLowerCase())
                .orElseThrow(() -> AppException.badRequest("Invalid email or password"));

        if (!Boolean.TRUE.equals(customer.getIsActive())) {
            throw AppException.badRequest("Account is deactivated");
        }

        if (!passwordEncoder.matches(request.getPassword(), customer.getPasswordHash())) {
            throw AppException.badRequest("Invalid email or password");
        }

        return issueTokens(customer);
    }

    @Transactional
    public CustomerAuthResponse refresh(String rawRefreshToken) {
        Long customerId;
        String rawSecret;
        try {
            customerId = jwtService.extractCustomerIdFromRefreshToken(rawRefreshToken);
            rawSecret  = jwtService.extractRawRefreshSecret(rawRefreshToken);
        } catch (Exception e) {
            throw AppException.badRequest("Invalid refresh token");
        }

        var tokens = refreshTokenRepository.findByCustomerIdAndRevokedFalse(customerId);
        boolean valid = tokens.stream().anyMatch(t ->
                !t.getExpiresAt().isBefore(Instant.now()) &&
                passwordEncoder.matches(rawSecret, t.getTokenHash()));

        if (!valid) throw AppException.badRequest("Refresh token is invalid or expired");

        // Rotate: revoke all existing tokens
        refreshTokenRepository.revokeAllByCustomerId(customerId);

        OnlineCustomer customer = customerRepository.findById(customerId)
                .orElseThrow(() -> AppException.notFound("Customer not found"));

        return issueTokens(customer);
    }

    @Transactional(readOnly = true)
    public CustomerProfileResponse getProfile(Long customerId) {
        OnlineCustomer customer = customerRepository.findById(customerId)
                .orElseThrow(() -> AppException.notFound("Customer not found"));
        return toProfileResponse(customer);
    }

    @Transactional
    public CustomerProfileResponse updateProfile(Long customerId, UpdateProfileRequest request) {
        OnlineCustomer customer = customerRepository.findById(customerId)
                .orElseThrow(() -> AppException.notFound("Customer not found"));
        customer.setFirstName(request.getFirstName().trim());
        customer.setLastName(request.getLastName().trim());
        customer.setPhone(request.getPhone());
        customer.setAddress(request.getAddress());
        return toProfileResponse(customerRepository.save(customer));
    }

    @Transactional
    public void logout(Long customerId) {
        refreshTokenRepository.revokeAllByCustomerId(customerId);
    }

    // ── Private helpers ────────────────────────────────────────────────────────

    private CustomerAuthResponse issueTokens(OnlineCustomer customer) {
        String accessToken = jwtService.generateCustomerAccessToken(customer);
        // rawSecret is the actual random value — what we BCrypt-hash for storage
        // refreshTokenWithId = "<customerId>.<rawSecret>" — the full token given to the client
        String rawSecret          = UUID.randomUUID().toString() + "-" + UUID.randomUUID().toString();
        String refreshTokenWithId = customer.getId() + "." + rawSecret;

        OnlineCustomerRefreshToken rt = OnlineCustomerRefreshToken.builder()
                .customer(customer)
                .tokenHash(passwordEncoder.encode(rawSecret))  // hash only the secret part
                .expiresAt(Instant.now().plus(30, ChronoUnit.DAYS))
                .revoked(false)
                .build();
        refreshTokenRepository.save(rt);

        return CustomerAuthResponse.builder()
                .accessToken(accessToken)
                .refreshToken(refreshTokenWithId)
                .customer(toProfileResponse(customer))
                .build();
    }

    public CustomerProfileResponse toProfileResponse(OnlineCustomer c) {
        return CustomerProfileResponse.builder()
                .id(c.getId())
                .storeId(c.getStore().getId())
                .storeName(c.getStore().getName())
                .email(c.getEmail())
                .firstName(c.getFirstName())
                .lastName(c.getLastName())
                .phone(c.getPhone())
                .address(c.getAddress())
                .emailVerified(c.getEmailVerified())
                .loyaltyPoints(c.getLoyaltyPoints())
                .isActive(c.getIsActive())
                .createdAt(c.getCreatedAt())
                .build();
    }
}

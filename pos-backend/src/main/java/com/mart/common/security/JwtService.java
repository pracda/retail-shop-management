package com.mart.common.security;

import com.mart.common.config.JwtProperties;
import com.mart.module.ecommerce.entity.OnlineCustomer;
import io.jsonwebtoken.*;
import io.jsonwebtoken.security.Keys;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import javax.crypto.SecretKey;
import java.nio.charset.StandardCharsets;
import java.util.Date;
import java.util.Map;

@Slf4j
@Service
@RequiredArgsConstructor
public class JwtService {

    private final JwtProperties jwtProperties;

    private SecretKey getSigningKey() {
        return Keys.hmacShaKeyFor(
                jwtProperties.getSecret().getBytes(StandardCharsets.UTF_8)
        );
    }

    public String generateAccessToken(UserPrincipal principal) {
        return Jwts.builder()
                .subject(String.valueOf(principal.getId()))
                .claims(Map.of(
                        "email",   principal.getEmail(),
                        "role",    principal.getRole(),
                        "storeId", principal.getStoreId() != null ? principal.getStoreId() : ""
                ))
                .issuedAt(new Date())
                .expiration(new Date(System.currentTimeMillis() + jwtProperties.getAccessTokenExpiryMs()))
                .signWith(getSigningKey())
                .compact();
    }

    public String generateRefreshToken(Long userId) {
        return Jwts.builder()
                .subject(String.valueOf(userId))
                .claim("type", "refresh")
                .issuedAt(new Date())
                .expiration(new Date(System.currentTimeMillis() + jwtProperties.getRefreshTokenExpiryMs()))
                .signWith(getSigningKey())
                .compact();
    }

    public Claims extractAllClaims(String token) {
        return Jwts.parser()
                .verifyWith(getSigningKey())
                .build()
                .parseSignedClaims(token)
                .getPayload();
    }

    public Long extractUserId(String token) {
        return Long.parseLong(extractAllClaims(token).getSubject());
    }

    public boolean isTokenValid(String token) {
        try {
            extractAllClaims(token);
            return true;
        } catch (ExpiredJwtException e) {
            log.warn("JWT expired: {}", e.getMessage());
        } catch (UnsupportedJwtException e) {
            log.warn("JWT unsupported: {}", e.getMessage());
        } catch (MalformedJwtException e) {
            log.warn("JWT malformed: {}", e.getMessage());
        } catch (SecurityException e) {
            log.warn("JWT signature invalid: {}", e.getMessage());
        } catch (IllegalArgumentException e) {
            log.warn("JWT empty/null: {}", e.getMessage());
        }
        return false;
    }

    public boolean isRefreshToken(String token) {
        try {
            Claims claims = extractAllClaims(token);
            return "refresh".equals(claims.get("type", String.class));
        } catch (Exception e) {
            return false;
        }
    }

    // ── Customer (ecommerce) token methods ────────────────────────────────────

    public String generateCustomerAccessToken(OnlineCustomer customer) {
        return Jwts.builder()
                .subject(String.valueOf(customer.getId()))
                .claims(Map.of(
                        "email",     customer.getEmail(),
                        "tokenType", "CUSTOMER",
                        "storeId",   customer.getStore().getId()
                ))
                .issuedAt(new Date())
                .expiration(new Date(System.currentTimeMillis() + jwtProperties.getAccessTokenExpiryMs()))
                .signWith(getSigningKey())
                .compact();
    }

    public boolean isCustomerToken(String token) {
        try {
            return "CUSTOMER".equals(extractAllClaims(token).get("tokenType", String.class));
        } catch (Exception e) {
            return false;
        }
    }

    public CustomerPrincipal extractCustomerPrincipal(String token) {
        Claims claims = extractAllClaims(token);
        return CustomerPrincipal.builder()
                .id(Long.parseLong(claims.getSubject()))
                .email(claims.get("email", String.class))
                .storeId(((Number) claims.get("storeId")).longValue())
                .build();
    }

    /**
     * Refresh tokens for customers are prefixed with the customerId:
     * format = "<customerId>.<uuid>.<uuid>"
     */
    public Long extractCustomerIdFromRefreshToken(String rawToken) {
        String[] parts = rawToken.split("\\.", 2);
        if (parts.length < 2) throw new IllegalArgumentException("Invalid refresh token format");
        return Long.parseLong(parts[0]);
    }

    /**
     * Returns the raw BCrypt-hashable portion of the customer refresh token
     * (everything after the first dot).
     */
    public String extractRawRefreshSecret(String rawToken) {
        int dot = rawToken.indexOf('.');
        if (dot < 0) throw new IllegalArgumentException("Invalid refresh token format");
        return rawToken.substring(dot + 1);
    }
}
package com.mart.module.ecommerce.repository;

import com.mart.module.ecommerce.entity.OnlineCustomerRefreshToken;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.Instant;
import java.util.List;

public interface OnlineCustomerRefreshTokenRepository extends JpaRepository<OnlineCustomerRefreshToken, Long> {

    List<OnlineCustomerRefreshToken> findByCustomerIdAndRevokedFalse(Long customerId);

    @Modifying
    @Query("UPDATE OnlineCustomerRefreshToken t SET t.revoked = true WHERE t.customer.id = :customerId")
    void revokeAllByCustomerId(@Param("customerId") Long customerId);

    @Modifying
    @Query("DELETE FROM OnlineCustomerRefreshToken t WHERE t.expiresAt < :now OR t.revoked = true")
    void deleteExpiredOrRevoked(@Param("now") Instant now);
}

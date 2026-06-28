package com.mart.module.ecommerce.repository;

import com.mart.module.ecommerce.entity.OnlineCart;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Optional;

public interface OnlineCartRepository extends JpaRepository<OnlineCart, Long> {

    @Query("SELECT c FROM OnlineCart c LEFT JOIN FETCH c.items i LEFT JOIN FETCH i.product " +
           "WHERE c.customer.id = :customerId AND c.store.id = :storeId")
    Optional<OnlineCart> findByCustomerIdAndStoreIdFetched(
            @Param("customerId") Long customerId, @Param("storeId") Long storeId);

    Optional<OnlineCart> findByCustomerIdAndStoreId(Long customerId, Long storeId);
}

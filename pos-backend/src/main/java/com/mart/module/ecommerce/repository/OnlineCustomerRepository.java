package com.mart.module.ecommerce.repository;

import com.mart.module.ecommerce.entity.OnlineCustomer;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface OnlineCustomerRepository extends JpaRepository<OnlineCustomer, Long> {
    Optional<OnlineCustomer> findByStoreIdAndEmail(Long storeId, String email);
    boolean existsByStoreIdAndEmail(Long storeId, String email);
}

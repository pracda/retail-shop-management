package com.mart.module.customer.repository;

import com.mart.module.customer.entity.Customer;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface CustomerRepository extends JpaRepository<Customer, Long> {

    Page<Customer> findByStoreId(Long storeId, Pageable pageable);

    Page<Customer> findByStoreIdAndPhoneContaining(Long storeId, String phone, Pageable pageable);

    Page<Customer> findByStoreIdAndNameContainingIgnoreCase(Long storeId, String name, Pageable pageable);

    Optional<Customer> findByStoreIdAndPhone(Long storeId, String phone);
}

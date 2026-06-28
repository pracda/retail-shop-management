package com.mart.module.store.repository;

import com.mart.module.store.entity.Store;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface StoreRepository extends JpaRepository<Store, Long> {

    List<Store> findByIsActiveTrue();
    Optional<Store> findByEmail(String email);
    boolean existsByEmail(String email);
}
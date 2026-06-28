package com.mart.module.store.service;

import com.mart.common.exception.AppException;
import com.mart.module.store.dto.CreateStoreRequest;
import com.mart.module.store.dto.StoreResponse;
import com.mart.module.store.dto.UpdateStoreRequest;
import com.mart.module.store.entity.Store;
import com.mart.module.store.repository.StoreRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class StoreService {

    private final StoreRepository storeRepository;

    @Transactional(readOnly = true)
    public List<StoreResponse> getAllStores() {
        return storeRepository.findByIsActiveTrue()
                .stream()
                .map(StoreResponse::from)
                .collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public StoreResponse getStore(Long id) {
        return StoreResponse.from(findById(id));
    }

    @Transactional
    public StoreResponse createStore(CreateStoreRequest req) {
        Store store = Store.builder()
                .name(req.name().trim())
                .address(req.address())
                .phone(req.phone())
                .email(req.email())
                .taxRate(req.taxRate() != null ? req.taxRate() : java.math.BigDecimal.ZERO)
                .isActive(true)
                .build();
        return StoreResponse.from(storeRepository.save(store));
    }

    @Transactional
    public void deactivateStore(Long id) {
        Store store = findById(id);
        store.setIsActive(false);
        storeRepository.save(store);
    }

    @Transactional
    public StoreResponse updateStore(Long id, UpdateStoreRequest req) {
        Store store = findById(id);
        store.setName(req.name());
        store.setAddress(req.address());
        store.setPhone(req.phone());
        store.setEmail(req.email());
        if (req.taxRate() != null) store.setTaxRate(req.taxRate());
        return StoreResponse.from(storeRepository.save(store));
    }

    private Store findById(Long id) {
        return storeRepository.findById(id)
                .orElseThrow(() -> AppException.notFound("Store not found"));
    }
}

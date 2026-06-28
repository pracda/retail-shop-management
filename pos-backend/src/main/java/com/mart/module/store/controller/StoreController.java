package com.mart.module.store.controller;

import com.mart.common.response.ApiResponse;
import com.mart.module.store.dto.CreateStoreRequest;
import com.mart.module.store.dto.StoreResponse;
import com.mart.module.store.dto.UpdateStoreRequest;
import com.mart.module.store.service.StoreService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/stores")
@RequiredArgsConstructor
public class StoreController {

    private final StoreService storeService;

    @GetMapping
    @PreAuthorize("hasRole('MASTER_ADMIN')")
    public ResponseEntity<ApiResponse<List<StoreResponse>>> getAllStores() {
        return ResponseEntity.ok(ApiResponse.success(storeService.getAllStores()));
    }

    /** Public endpoint — returns only id + name for the PIN login store selector. No auth required. */
    @GetMapping("/public")
    public ResponseEntity<ApiResponse<List<StoreResponse>>> getPublicStoreList() {
        return ResponseEntity.ok(ApiResponse.success(storeService.getAllStores()));
    }

    @GetMapping("/{id}")
    @PreAuthorize("hasAnyRole('MASTER_ADMIN', 'ADMIN', 'MANAGER')")
    public ResponseEntity<ApiResponse<StoreResponse>> getStore(@PathVariable Long id) {
        return ResponseEntity.ok(ApiResponse.success(storeService.getStore(id)));
    }

    @PostMapping
    @PreAuthorize("hasRole('MASTER_ADMIN')")
    public ResponseEntity<ApiResponse<StoreResponse>> createStore(
            @Valid @RequestBody CreateStoreRequest req) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.success("Store created successfully", storeService.createStore(req)));
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasAnyRole('MASTER_ADMIN', 'ADMIN')")
    public ResponseEntity<ApiResponse<StoreResponse>> updateStore(
            @PathVariable Long id,
            @Valid @RequestBody UpdateStoreRequest req) {
        return ResponseEntity.ok(ApiResponse.success(storeService.updateStore(id, req)));
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasRole('MASTER_ADMIN')")
    public ResponseEntity<ApiResponse<Void>> deactivateStore(@PathVariable Long id) {
        storeService.deactivateStore(id);
        return ResponseEntity.ok(ApiResponse.success("Store deactivated", null));
    }
}

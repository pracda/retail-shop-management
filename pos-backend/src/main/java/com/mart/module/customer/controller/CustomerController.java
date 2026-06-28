package com.mart.module.customer.controller;

import com.mart.common.response.ApiResponse;
import com.mart.common.response.PageResponse;
import com.mart.module.customer.dto.CreateCustomerRequest;
import com.mart.module.customer.dto.CustomerResponse;
import com.mart.module.customer.dto.UpdateCustomerRequest;
import com.mart.module.customer.service.CustomerService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/customers")
@RequiredArgsConstructor
public class CustomerController {

    private final CustomerService customerService;

    @GetMapping
    @PreAuthorize("hasAnyRole('MASTER_ADMIN', 'ADMIN', 'MANAGER', 'CASHIER')")
    public ResponseEntity<ApiResponse<PageResponse<CustomerResponse>>> getCustomers(
            @RequestParam Long storeId,
            @RequestParam(required = false) String search,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        return ResponseEntity.ok(ApiResponse.success(customerService.getCustomers(storeId, search, page, size)));
    }

    @GetMapping("/{id}")
    @PreAuthorize("hasAnyRole('MASTER_ADMIN', 'ADMIN', 'MANAGER', 'CASHIER')")
    public ResponseEntity<ApiResponse<CustomerResponse>> getCustomer(@PathVariable Long id) {
        return ResponseEntity.ok(ApiResponse.success(customerService.getCustomer(id)));
    }

    @GetMapping("/by-phone")
    @PreAuthorize("hasAnyRole('MASTER_ADMIN', 'ADMIN', 'MANAGER', 'CASHIER')")
    public ResponseEntity<ApiResponse<CustomerResponse>> findByPhone(
            @RequestParam Long storeId,
            @RequestParam String phone) {
        return customerService.findByPhone(storeId, phone)
                .map(c -> ResponseEntity.ok(ApiResponse.success(c)))
                .orElseGet(() -> ResponseEntity.ok(ApiResponse.success(null)));
    }

    @PostMapping
    @PreAuthorize("hasAnyRole('MASTER_ADMIN', 'ADMIN', 'MANAGER', 'CASHIER')")
    public ResponseEntity<ApiResponse<CustomerResponse>> createCustomer(
            @Valid @RequestBody CreateCustomerRequest req) {
        return ResponseEntity.ok(ApiResponse.success(customerService.createCustomer(req)));
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasAnyRole('MASTER_ADMIN', 'ADMIN', 'MANAGER', 'CASHIER')")
    public ResponseEntity<ApiResponse<CustomerResponse>> updateCustomer(
            @PathVariable Long id,
            @Valid @RequestBody UpdateCustomerRequest req) {
        return ResponseEntity.ok(ApiResponse.success(customerService.updateCustomer(id, req)));
    }
}

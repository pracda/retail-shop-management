package com.mart.module.customer.service;

import com.mart.common.exception.AppException;
import com.mart.common.response.PageResponse;
import com.mart.module.customer.dto.CreateCustomerRequest;
import com.mart.module.customer.dto.CustomerResponse;
import com.mart.module.customer.dto.UpdateCustomerRequest;
import com.mart.module.customer.entity.Customer;
import com.mart.module.customer.repository.CustomerRepository;
import com.mart.module.store.entity.Store;
import com.mart.module.store.repository.StoreRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.util.Optional;

@Service
@RequiredArgsConstructor
public class CustomerService {

    private final CustomerRepository customerRepository;
    private final StoreRepository storeRepository;

    @Transactional(readOnly = true)
    public PageResponse<CustomerResponse> getCustomers(Long storeId, String search, int page, int size) {
        var pageable = PageRequest.of(page, size);
        var result = StringUtils.hasText(search)
                ? (search.matches("\\d+")
                    ? customerRepository.findByStoreIdAndPhoneContaining(storeId, search, pageable)
                    : customerRepository.findByStoreIdAndNameContainingIgnoreCase(storeId, search, pageable))
                : customerRepository.findByStoreId(storeId, pageable);
        return PageResponse.from(result.map(CustomerResponse::from));
    }

    @Transactional(readOnly = true)
    public CustomerResponse getCustomer(Long id) {
        return customerRepository.findById(id)
                .map(CustomerResponse::from)
                .orElseThrow(() -> AppException.notFound("Customer not found"));
    }

    @Transactional(readOnly = true)
    public Optional<CustomerResponse> findByPhone(Long storeId, String phone) {
        return customerRepository.findByStoreIdAndPhone(storeId, phone)
                .map(CustomerResponse::from);
    }

    @Transactional
    public CustomerResponse createCustomer(CreateCustomerRequest req) {
        Store store = storeRepository.findById(req.storeId())
                .orElseThrow(() -> AppException.notFound("Store not found"));

        Customer customer = Customer.builder()
                .store(store)
                .name(req.name())
                .phone(req.phone())
                .email(req.email())
                .address(req.address())
                .notes(req.notes())
                .isActive(true)
                .build();

        return CustomerResponse.from(customerRepository.save(customer));
    }

    @Transactional
    public CustomerResponse updateCustomer(Long id, UpdateCustomerRequest req) {
        Customer customer = customerRepository.findById(id)
                .orElseThrow(() -> AppException.notFound("Customer not found"));

        customer.setName(req.name());
        customer.setPhone(req.phone());
        customer.setEmail(req.email());
        customer.setAddress(req.address());
        customer.setNotes(req.notes());

        return CustomerResponse.from(customerRepository.save(customer));
    }
}

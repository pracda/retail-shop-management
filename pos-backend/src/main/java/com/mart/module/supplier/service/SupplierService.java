package com.mart.module.supplier.service;

import com.mart.common.exception.AppException;
import com.mart.common.response.PageResponse;
import com.mart.module.store.entity.Store;
import com.mart.module.store.repository.StoreRepository;
import com.mart.module.supplier.dto.CreateSupplierRequest;
import com.mart.module.supplier.dto.SupplierResponse;
import com.mart.module.supplier.dto.UpdateSupplierRequest;
import com.mart.module.supplier.entity.Supplier;
import com.mart.module.supplier.repository.SupplierRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class SupplierService {

    private final SupplierRepository supplierRepository;
    private final StoreRepository storeRepository;

    @Transactional(readOnly = true)
    public PageResponse<SupplierResponse> getSuppliers(Long storeId, int page, int size) {
        return PageResponse.from(
                supplierRepository.findByStoreId(storeId, PageRequest.of(page, size))
                        .map(SupplierResponse::from));
    }

    @Transactional
    public SupplierResponse createSupplier(CreateSupplierRequest req) {
        Store store = storeRepository.findById(req.storeId())
                .orElseThrow(() -> AppException.notFound("Store not found"));

        Supplier supplier = Supplier.builder()
                .store(store)
                .name(req.name())
                .contactName(req.contactName())
                .phone(req.phone())
                .email(req.email())
                .address(req.address())
                .notes(req.notes())
                .isActive(true)
                .build();

        return SupplierResponse.from(supplierRepository.save(supplier));
    }

    @Transactional
    public SupplierResponse updateSupplier(Long id, UpdateSupplierRequest req) {
        Supplier supplier = supplierRepository.findById(id)
                .orElseThrow(() -> AppException.notFound("Supplier not found"));

        supplier.setName(req.name());
        supplier.setContactName(req.contactName());
        supplier.setPhone(req.phone());
        supplier.setEmail(req.email());
        supplier.setAddress(req.address());
        supplier.setNotes(req.notes());

        return SupplierResponse.from(supplierRepository.save(supplier));
    }

    @Transactional
    public void deactivateSupplier(Long id) {
        Supplier supplier = supplierRepository.findById(id)
                .orElseThrow(() -> AppException.notFound("Supplier not found"));
        supplier.setIsActive(false);
        supplierRepository.save(supplier);
    }
}

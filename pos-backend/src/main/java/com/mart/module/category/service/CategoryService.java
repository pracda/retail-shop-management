package com.mart.module.category.service;

import com.mart.common.exception.AppException;
import com.mart.common.response.PageResponse;
import com.mart.module.category.dto.request.CreateCategoryRequest;
import com.mart.module.category.dto.request.UpdateCategoryRequest;
import com.mart.module.category.dto.response.CategoryResponse;
import com.mart.module.category.entity.Category;
import com.mart.module.category.repository.CategoryRepository;
import com.mart.module.store.entity.Store;
import com.mart.module.store.repository.StoreRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Slf4j
@Service
@RequiredArgsConstructor
public class CategoryService {

    private final CategoryRepository categoryRepository;
    private final StoreRepository storeRepository;

    @Transactional(readOnly = true)
    public PageResponse<CategoryResponse> getCategories(Long storeId, Boolean activeOnly, Pageable pageable) {
        var page = activeOnly
                ? categoryRepository.findByStoreIdAndIsActive(storeId, true, pageable)
                : categoryRepository.findByStoreId(storeId, pageable);
        return PageResponse.from(page.map(this::toResponse));
    }

    @Transactional(readOnly = true)
    public CategoryResponse getCategoryById(Long id) {
        return categoryRepository.findById(id)
                .map(this::toResponse)
                .orElseThrow(() -> AppException.notFound("Category not found with id: " + id));
    }

    @Transactional
    public CategoryResponse createCategory(CreateCategoryRequest request) {
        Store store = storeRepository.findById(request.getStoreId())
                .orElseThrow(() -> AppException.notFound("Store not found with id: " + request.getStoreId()));

        if (categoryRepository.existsByStoreIdAndNameIgnoreCase(store.getId(), request.getName())) {
            throw AppException.conflict("Category '" + request.getName() + "' already exists in this store");
        }

        Category category = Category.builder()
                .store(store)
                .name(request.getName().trim())
                .description(request.getDescription())
                .isActive(true)
                .build();

        Category saved = categoryRepository.save(category);
        log.info("Category created: '{}' in store {}", saved.getName(), store.getId());
        return toResponse(saved);
    }

    @Transactional
    public CategoryResponse updateCategory(Long id, UpdateCategoryRequest request) {
        Category category = categoryRepository.findById(id)
                .orElseThrow(() -> AppException.notFound("Category not found with id: " + id));

        if (categoryRepository.existsByStoreIdAndNameIgnoreCaseAndIdNot(
                category.getStore().getId(), request.getName(), id)) {
            throw AppException.conflict("Category '" + request.getName() + "' already exists in this store");
        }

        category.setName(request.getName().trim());
        category.setDescription(request.getDescription());
        return toResponse(categoryRepository.save(category));
    }

    @Transactional
    public void setCategoryStatus(Long id, boolean active) {
        Category category = categoryRepository.findById(id)
                .orElseThrow(() -> AppException.notFound("Category not found with id: " + id));
        category.setIsActive(active);
        categoryRepository.save(category);
        log.info("Category {} status set to active={}", id, active);
    }

    private CategoryResponse toResponse(Category c) {
        return CategoryResponse.builder()
                .id(c.getId())
                .storeId(c.getStore().getId())
                .storeName(c.getStore().getName())
                .name(c.getName())
                .description(c.getDescription())
                .isActive(c.getIsActive())
                .createdAt(c.getCreatedAt())
                .build();
    }
}

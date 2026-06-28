package com.mart.module.ecommerce.controller;

import com.mart.common.response.ApiResponse;
import com.mart.common.response.PageResponse;
import com.mart.module.category.dto.response.CategoryResponse;
import com.mart.module.ecommerce.dto.response.CatalogProductResponse;
import com.mart.module.ecommerce.service.EcommerceCatalogService;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/**
 * Fully public — no authentication required.
 * Rate-limited by RateLimitFilter.
 */
@RestController
@RequestMapping("/ecommerce/catalog")
@RequiredArgsConstructor
public class EcommerceCatalogController {

    private final EcommerceCatalogService catalogService;

    @GetMapping("/products")
    public ResponseEntity<ApiResponse<PageResponse<CatalogProductResponse>>> getProducts(
            @RequestParam Long storeId,
            @RequestParam(required = false) Long categoryId,
            @RequestParam(required = false) String search,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size,
            @RequestParam(defaultValue = "name") String sortBy,
            @RequestParam(defaultValue = "asc") String direction) {

        // Clamp page size to prevent abuse
        size = Math.min(size, 100);

        var sort = direction.equalsIgnoreCase("desc")
                ? Sort.by(sortBy).descending()
                : Sort.by(sortBy).ascending();
        var pageable = PageRequest.of(page, size, sort);

        return ResponseEntity.ok(ApiResponse.success(
                catalogService.getProducts(storeId, categoryId, search, pageable)));
    }

    @GetMapping("/products/{id}")
    public ResponseEntity<ApiResponse<CatalogProductResponse>> getProduct(
            @PathVariable Long id,
            @RequestParam Long storeId) {
        return ResponseEntity.ok(ApiResponse.success(catalogService.getProduct(storeId, id)));
    }

    @GetMapping("/products/{id}/variants")
    public ResponseEntity<ApiResponse<List<CatalogProductResponse>>> getVariants(
            @PathVariable Long id,
            @RequestParam Long storeId) {
        return ResponseEntity.ok(ApiResponse.success(catalogService.getVariants(storeId, id)));
    }

    @GetMapping("/categories")
    public ResponseEntity<ApiResponse<List<CategoryResponse>>> getCategories(
            @RequestParam Long storeId) {
        return ResponseEntity.ok(ApiResponse.success(catalogService.getCategories(storeId)));
    }
}

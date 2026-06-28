package com.mart.module.product.controller;

import com.mart.common.response.ApiResponse;
import com.mart.common.response.PageResponse;
import com.mart.module.product.dto.request.CreateProductRequest;
import com.mart.module.product.dto.request.UpdateProductRequest;
import com.mart.module.product.dto.response.ProductResponse;
import com.mart.module.product.service.ProductService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;

@RestController
@RequestMapping("/products")
@RequiredArgsConstructor
public class ProductController {

    private final ProductService productService;

    @GetMapping
    @PreAuthorize("hasAnyRole('MASTER_ADMIN', 'ADMIN', 'MANAGER', 'CASHIER')")
    public ResponseEntity<ApiResponse<PageResponse<ProductResponse>>> getProducts(
            @RequestParam Long storeId,
            @RequestParam(required = false) Long categoryId,
            @RequestParam(required = false) String search,
            @RequestParam(defaultValue = "false") boolean onlyParents,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size,
            @RequestParam(defaultValue = "name") String sortBy,
            @RequestParam(defaultValue = "asc") String direction) {

        var sort = direction.equalsIgnoreCase("desc")
                ? Sort.by(sortBy).descending()
                : Sort.by(sortBy).ascending();
        var pageable = PageRequest.of(page, size, sort);
        return ResponseEntity.ok(ApiResponse.success(
                productService.getProducts(storeId, categoryId, search, onlyParents, pageable)));
    }

    @GetMapping("/{id}")
    @PreAuthorize("hasAnyRole('MASTER_ADMIN', 'ADMIN', 'MANAGER', 'CASHIER')")
    public ResponseEntity<ApiResponse<ProductResponse>> getProductById(@PathVariable Long id) {
        return ResponseEntity.ok(ApiResponse.success(productService.getProductById(id)));
    }

    @GetMapping("/{id}/variants")
    @PreAuthorize("hasAnyRole('MASTER_ADMIN', 'ADMIN', 'MANAGER', 'CASHIER')")
    public ResponseEntity<ApiResponse<List<ProductResponse>>> getVariants(@PathVariable Long id) {
        return ResponseEntity.ok(ApiResponse.success(productService.getVariantsByParent(id)));
    }

    @GetMapping("/barcode/{barcode}")
    @PreAuthorize("hasAnyRole('MASTER_ADMIN', 'ADMIN', 'MANAGER', 'CASHIER')")
    public ResponseEntity<ApiResponse<ProductResponse>> getProductByBarcode(
            @RequestParam Long storeId,
            @PathVariable String barcode) {
        return ResponseEntity.ok(ApiResponse.success(
                productService.getProductByBarcode(storeId, barcode)));
    }

    @PostMapping
    @PreAuthorize("hasAnyRole('MASTER_ADMIN', 'ADMIN', 'MANAGER')")
    public ResponseEntity<ApiResponse<ProductResponse>> createProduct(
            @Valid @RequestBody CreateProductRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.success("Product created successfully",
                        productService.createProduct(request)));
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasAnyRole('MASTER_ADMIN', 'ADMIN', 'MANAGER')")
    public ResponseEntity<ApiResponse<ProductResponse>> updateProduct(
            @PathVariable Long id,
            @Valid @RequestBody UpdateProductRequest request) {
        return ResponseEntity.ok(ApiResponse.success("Product updated successfully",
                productService.updateProduct(id, request)));
    }

    @PatchMapping("/{id}/activate")
    @PreAuthorize("hasAnyRole('MASTER_ADMIN', 'ADMIN', 'MANAGER')")
    public ResponseEntity<ApiResponse<Void>> activateProduct(@PathVariable Long id) {
        productService.setProductStatus(id, true);
        return ResponseEntity.ok(ApiResponse.success("Product activated", null));
    }

    @PatchMapping("/{id}/deactivate")
    @PreAuthorize("hasAnyRole('MASTER_ADMIN', 'ADMIN', 'MANAGER')")
    public ResponseEntity<ApiResponse<Void>> deactivateProduct(@PathVariable Long id) {
        productService.setProductStatus(id, false);
        return ResponseEntity.ok(ApiResponse.success("Product deactivated", null));
    }

    /** Bulk import from CSV. Columns: name,barcode,sku,sellingPrice,costPrice */
    @PostMapping("/import")
    @PreAuthorize("hasAnyRole('MASTER_ADMIN', 'ADMIN', 'MANAGER')")
    public ResponseEntity<ApiResponse<ProductService.ImportResult>> importCsv(
            @RequestParam Long storeId,
            @RequestParam("file") MultipartFile file) {
        return ResponseEntity.ok(ApiResponse.success(productService.importCsv(storeId, file)));
    }
}

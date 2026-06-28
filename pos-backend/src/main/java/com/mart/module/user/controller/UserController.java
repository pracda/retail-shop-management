package com.mart.module.user.controller;

import com.mart.common.constant.RoleConstants;
import com.mart.common.response.ApiResponse;
import com.mart.common.response.PageResponse;
import com.mart.module.user.dto.request.*;
import com.mart.module.user.dto.response.UserResponse;
import com.mart.module.user.service.UserService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/users")
@RequiredArgsConstructor
public class UserController {

    private final UserService userService;

    @GetMapping
    @PreAuthorize("hasAnyRole('MASTER_ADMIN', 'ADMIN', 'MANAGER')")
    public ResponseEntity<ApiResponse<PageResponse<UserResponse>>> getAllUsers(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size,
            @RequestParam(defaultValue = "createdAt") String sortBy,
            @RequestParam(defaultValue = "desc") String direction) {

        Sort sort = direction.equalsIgnoreCase("desc")
                ? Sort.by(sortBy).descending()
                : Sort.by(sortBy).ascending();

        Pageable pageable = PageRequest.of(page, size, sort);
        return ResponseEntity.ok(ApiResponse.success(userService.getAllUsers(pageable)));
    }

    @GetMapping("/{id}")
    @PreAuthorize("hasAnyRole('MASTER_ADMIN', 'ADMIN', 'MANAGER')")
    public ResponseEntity<ApiResponse<UserResponse>> getUserById(@PathVariable Long id) {
        return ResponseEntity.ok(ApiResponse.success(userService.getUserById(id)));
    }

    @PostMapping
    @PreAuthorize("hasAnyRole('MASTER_ADMIN', 'ADMIN')")
    public ResponseEntity<ApiResponse<UserResponse>> createUser(
            @Valid @RequestBody CreateUserRequest request) {
        UserResponse response = userService.createUser(request);
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.success("User created successfully", response));
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasAnyRole('MASTER_ADMIN', 'ADMIN')")
    public ResponseEntity<ApiResponse<UserResponse>> updateUser(
            @PathVariable Long id,
            @Valid @RequestBody UpdateUserRequest request) {
        return ResponseEntity.ok(
                ApiResponse.success("User updated successfully", userService.updateUser(id, request)));
    }

    @PatchMapping("/{id}/activate")
    @PreAuthorize("hasAnyRole('MASTER_ADMIN', 'ADMIN')")
    public ResponseEntity<ApiResponse<Void>> activateUser(@PathVariable Long id) {
        userService.setUserStatus(id, true);
        return ResponseEntity.ok(ApiResponse.success("User activated", null));
    }

    @PatchMapping("/{id}/deactivate")
    @PreAuthorize("hasAnyRole('MASTER_ADMIN', 'ADMIN')")
    public ResponseEntity<ApiResponse<Void>> deactivateUser(@PathVariable Long id) {
        userService.setUserStatus(id, false);
        return ResponseEntity.ok(ApiResponse.success("User deactivated", null));
    }

    @PatchMapping("/{id}/password")
    @PreAuthorize("hasAnyRole('MASTER_ADMIN', 'ADMIN') or #id == authentication.principal.id")
    public ResponseEntity<ApiResponse<Void>> changePassword(
            @PathVariable Long id,
            @Valid @RequestBody ChangePasswordRequest request) {
        userService.changePassword(id, request);
        return ResponseEntity.ok(ApiResponse.success("Password changed successfully", null));
    }

    @PatchMapping("/{id}/pin")
    @PreAuthorize("hasAnyRole('MASTER_ADMIN', 'ADMIN', 'MANAGER')")
    public ResponseEntity<ApiResponse<Void>> assignPin(
            @PathVariable Long id,
            @Valid @RequestBody AssignPinRequest request) {
        userService.assignPin(id, request);
        return ResponseEntity.ok(ApiResponse.success("PIN assigned successfully", null));
    }

    @PatchMapping("/{id}/role")
    @PreAuthorize("hasAnyRole('MASTER_ADMIN', 'ADMIN')")
    public ResponseEntity<ApiResponse<UserResponse>> changeRole(
            @PathVariable Long id,
            @RequestBody Map<String, Long> body) {
        Long roleId = body.get("roleId");
        if (roleId == null) throw com.mart.common.exception.AppException.badRequest("roleId is required");
        return ResponseEntity.ok(ApiResponse.success("Role updated successfully",
                userService.changeRole(id, roleId)));
    }
}
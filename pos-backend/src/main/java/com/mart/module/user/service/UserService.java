package com.mart.module.user.service;

import com.mart.common.exception.AppException;
import com.mart.common.response.PageResponse;
import com.mart.module.store.entity.Store;
import com.mart.module.store.repository.StoreRepository;
import com.mart.module.user.dto.request.*;
import com.mart.module.user.dto.response.UserResponse;
import com.mart.module.user.entity.Role;
import com.mart.module.user.entity.User;
import com.mart.module.user.repository.RoleRepository;
import com.mart.module.user.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Slf4j
@Service
@RequiredArgsConstructor
public class UserService {

    private final UserRepository userRepository;
    private final RoleRepository roleRepository;
    private final StoreRepository storeRepository;
    private final PasswordEncoder passwordEncoder;

    @Transactional(readOnly = true)
    public PageResponse<UserResponse> getAllUsers(Pageable pageable) {
        Page<UserResponse> page = userRepository.findAll(pageable)
                .map(this::toResponse);
        return PageResponse.from(page);
    }

    @Transactional(readOnly = true)
    public UserResponse getUserById(Long id) {
        return userRepository.findByIdWithRole(id)
                .map(this::toResponse)
                .orElseThrow(() -> AppException.notFound("User not found with id: " + id));
    }

    @Transactional
    public UserResponse createUser(CreateUserRequest request) {
        if (request.getEmail() != null && userRepository.existsByEmail(request.getEmail())) {
            throw AppException.conflict("Email already in use: " + request.getEmail());
        }

        Role role = roleRepository.findById(request.getRoleId())
                .orElseThrow(() -> AppException.notFound("Role not found with id: " + request.getRoleId()));

        Store store = null;
        if (request.getStoreId() != null) {
            store = storeRepository.findById(request.getStoreId())
                    .orElseThrow(() -> AppException.notFound("Store not found with id: " + request.getStoreId()));
        }

        User user = User.builder()
                .firstName(request.getFirstName())
                .lastName(request.getLastName())
                .email(request.getEmail())
                .phone(request.getPhone())
                .passwordHash(passwordEncoder.encode(request.getPassword()))
                .role(role)
                .store(store)
                .isActive(true)
                .build();

        if (request.getPin() != null && !request.getPin().isBlank()) {
            user.setPinHash(passwordEncoder.encode(request.getPin()));
        }

        User saved = userRepository.save(user);
        log.info("User created: {} (role: {})", saved.getEmail(), role.getName());
        return toResponse(saved);
    }

    @Transactional
    public UserResponse updateUser(Long id, UpdateUserRequest request) {
        User user = userRepository.findById(id)
                .orElseThrow(() -> AppException.notFound("User not found with id: " + id));

        if (request.getEmail() != null
                && !request.getEmail().equals(user.getEmail())
                && userRepository.existsByEmail(request.getEmail())) {
            throw AppException.conflict("Email already in use: " + request.getEmail());
        }

        user.setFirstName(request.getFirstName());
        user.setLastName(request.getLastName());
        user.setEmail(request.getEmail());
        user.setPhone(request.getPhone());

        if (request.getStoreId() != null) {
            Store store = storeRepository.findById(request.getStoreId())
                    .orElseThrow(() -> AppException.notFound("Store not found"));
            user.setStore(store);
        }

        return toResponse(userRepository.save(user));
    }

    @Transactional
    public void setUserStatus(Long id, boolean active) {
        User user = userRepository.findById(id)
                .orElseThrow(() -> AppException.notFound("User not found with id: " + id));
        user.setIsActive(active);
        userRepository.save(user);
        log.info("User {} status set to active={}", id, active);
    }

    @Transactional
    public void changePassword(Long id, ChangePasswordRequest request) {
        if (!request.getNewPassword().equals(request.getConfirmPassword())) {
            throw AppException.badRequest("New password and confirm password do not match");
        }

        User user = userRepository.findById(id)
                .orElseThrow(() -> AppException.notFound("User not found"));

        if (!passwordEncoder.matches(request.getCurrentPassword(), user.getPasswordHash())) {
            throw AppException.badRequest("Current password is incorrect");
        }

        user.setPasswordHash(passwordEncoder.encode(request.getNewPassword()));
        userRepository.save(user);
        log.info("Password changed for user {}", id);
    }

    @Transactional
    public void assignPin(Long id, AssignPinRequest request) {
        User user = userRepository.findById(id)
                .orElseThrow(() -> AppException.notFound("User not found"));
        user.setPinHash(passwordEncoder.encode(request.getPin()));
        userRepository.save(user);
        log.info("PIN assigned for user {}", id);
    }

    @Transactional
    public UserResponse changeRole(Long id, Long roleId) {
        User user = userRepository.findById(id)
                .orElseThrow(() -> AppException.notFound("User not found with id: " + id));
        Role role = roleRepository.findById(roleId)
                .orElseThrow(() -> AppException.notFound("Role not found with id: " + roleId));
        user.setRole(role);
        User updated = userRepository.save(user);
        log.info("Role changed for user {} to {}", id, role.getName());
        return toResponse(updated);
    }

    private UserResponse toResponse(User user) {
        return UserResponse.builder()
                .id(user.getId())
                .firstName(user.getFirstName())
                .lastName(user.getLastName())
                .email(user.getEmail())
                .phone(user.getPhone())
                .role(user.getRole().getName())
                .roleId(user.getRole().getId())
                .storeId(user.getStore() != null ? user.getStore().getId() : null)
                .storeName(user.getStore() != null ? user.getStore().getName() : null)
                .isActive(user.getIsActive())
                .lastLoginAt(user.getLastLoginAt())
                .createdAt(user.getCreatedAt())
                .build();
    }
}
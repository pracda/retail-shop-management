package com.mart.module.auth.service;

import com.mart.common.security.UserPrincipal;
import com.mart.module.user.entity.User;
import com.mart.module.user.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class UserDetailsServiceImpl implements UserDetailsService {

    private final UserRepository userRepository;

    @Override
    @Transactional(readOnly = true)
    public UserDetails loadUserByUsername(String identifier) throws UsernameNotFoundException {
        User user;

        // JWT filter passes userId as string, login passes email
        try {
            Long userId = Long.parseLong(identifier);
            user = userRepository.findByIdWithRole(userId)
                    .orElseThrow(() -> new UsernameNotFoundException("User not found: " + identifier));
        } catch (NumberFormatException e) {
            user = userRepository.findByEmail(identifier)
                    .orElseThrow(() -> new UsernameNotFoundException("User not found: " + identifier));
        }

        return UserPrincipal.builder()
                .id(user.getId())
                .storeId(user.getStore() != null ? user.getStore().getId() : null)
                .firstName(user.getFirstName())
                .lastName(user.getLastName())
                .email(user.getEmail())
                .password(user.getPasswordHash())
                .role(user.getRole().getName())
                .active(user.getIsActive())
                .build();
    }
}
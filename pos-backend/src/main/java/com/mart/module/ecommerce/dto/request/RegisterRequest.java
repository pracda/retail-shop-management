package com.mart.module.ecommerce.dto.request;

import jakarta.validation.constraints.*;
import lombok.Data;

@Data
public class RegisterRequest {

    @NotNull
    private Long storeId;

    @NotBlank
    @Email(message = "Invalid email address")
    @Size(max = 255)
    private String email;

    @NotBlank
    @Size(min = 8, max = 72, message = "Password must be 8–72 characters")
    @Pattern(
        regexp = "^(?=.*[a-z])(?=.*[A-Z])(?=.*\\d)(?=.*[@$!%*?&\\-_])[A-Za-z\\d@$!%*?&\\-_]+$",
        message = "Password needs uppercase, lowercase, number and special character"
    )
    private String password;

    @NotBlank @Size(min = 2, max = 100)
    private String firstName;

    @NotBlank @Size(min = 2, max = 100)
    private String lastName;

    @Size(max = 30)
    private String phone;
}

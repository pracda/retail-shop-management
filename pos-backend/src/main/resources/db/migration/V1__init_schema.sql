CREATE TABLE stores (
    id          BIGINT          NOT NULL AUTO_INCREMENT,
    name        VARCHAR(100)    NOT NULL,
    address     VARCHAR(255),
    phone       VARCHAR(20),
    email       VARCHAR(100),
    is_active   BOOLEAN         NOT NULL DEFAULT TRUE,
    created_at  DATETIME(6)     NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at  DATETIME(6)     NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
    created_by  BIGINT,
    updated_by  BIGINT,
    PRIMARY KEY (id),
    UNIQUE KEY uk_stores_email (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE roles (
    id          BIGINT          NOT NULL AUTO_INCREMENT,
    name        VARCHAR(50)     NOT NULL,
    description VARCHAR(255),
    created_at  DATETIME(6)     NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    PRIMARY KEY (id),
    UNIQUE KEY uk_roles_name (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE users (
    id              BIGINT          NOT NULL AUTO_INCREMENT,
    store_id        BIGINT,
    first_name      VARCHAR(50)     NOT NULL,
    last_name       VARCHAR(50)     NOT NULL,
    email           VARCHAR(100),
    phone           VARCHAR(20),
    pin_hash        VARCHAR(255),
    password_hash   VARCHAR(255),
    role_id         BIGINT          NOT NULL,
    is_active       BOOLEAN         NOT NULL DEFAULT TRUE,
    last_login_at   DATETIME(6),
    created_at      DATETIME(6)     NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at      DATETIME(6)     NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
    created_by      BIGINT,
    updated_by      BIGINT,
    PRIMARY KEY (id),
    UNIQUE KEY uk_users_email (email),
    CONSTRAINT fk_users_role    FOREIGN KEY (role_id)   REFERENCES roles (id),
    CONSTRAINT fk_users_store   FOREIGN KEY (store_id)  REFERENCES stores (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE refresh_tokens (
    id          BIGINT          NOT NULL AUTO_INCREMENT,
    user_id     BIGINT          NOT NULL,
    token_hash  VARCHAR(255)    NOT NULL,
    expires_at  DATETIME(6)     NOT NULL,
    revoked     BOOLEAN         NOT NULL DEFAULT FALSE,
    created_at  DATETIME(6)     NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    PRIMARY KEY (id),
    UNIQUE KEY uk_refresh_tokens_hash (token_hash),
    CONSTRAINT fk_refresh_tokens_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO roles (name, description) VALUES
    ('MASTER_ADMIN', 'Full system access across all stores'),
    ('ADMIN',        'Full access to assigned store'),
    ('MANAGER',      'Inventory, pricing, reports, cashier management'),
    ('CASHIER',      'POS operations only');

INSERT INTO stores (name, address, phone, email) VALUES
    ('Main Store', 'Kathmandu, Nepal', '+977-1-0000000', 'store@mart.com');

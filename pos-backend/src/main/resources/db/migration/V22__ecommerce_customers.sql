-- ── Ecommerce: Online Customer accounts ──────────────────────────────────────
-- Separate from POS staff users. Customers register on the storefront.

CREATE TABLE online_customers (
    id            BIGINT AUTO_INCREMENT PRIMARY KEY,
    store_id      BIGINT NOT NULL,
    email         VARCHAR(255) NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    first_name    VARCHAR(100) NOT NULL,
    last_name     VARCHAR(100) NOT NULL,
    phone         VARCHAR(30),
    address       TEXT,
    email_verified   BOOLEAN NOT NULL DEFAULT FALSE,
    loyalty_points   INT NOT NULL DEFAULT 0,
    is_active        BOOLEAN NOT NULL DEFAULT TRUE,
    created_at    DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at    DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
    UNIQUE KEY uq_online_customer_store_email (store_id, email),
    CONSTRAINT fk_oc_store FOREIGN KEY (store_id) REFERENCES stores(id)
) ENGINE=InnoDB;

-- Refresh token store for online customers (separate from staff refresh tokens)
CREATE TABLE online_customer_refresh_tokens (
    id          BIGINT AUTO_INCREMENT PRIMARY KEY,
    customer_id BIGINT NOT NULL,
    token_hash  VARCHAR(255) NOT NULL,   -- BCrypt hash of the token value
    expires_at  DATETIME(6) NOT NULL,
    revoked     BOOLEAN NOT NULL DEFAULT FALSE,
    created_at  DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    KEY idx_ocrt_customer (customer_id),
    KEY idx_ocrt_hash (token_hash(64)),
    CONSTRAINT fk_ocrt_customer FOREIGN KEY (customer_id)
        REFERENCES online_customers(id) ON DELETE CASCADE
) ENGINE=InnoDB;

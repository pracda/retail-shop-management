CREATE TABLE suppliers (
    id           BIGINT AUTO_INCREMENT PRIMARY KEY,
    store_id     BIGINT        NOT NULL,
    name         VARCHAR(200)  NOT NULL,
    contact_name VARCHAR(200)  NULL,
    phone        VARCHAR(50)   NULL,
    email        VARCHAR(200)  NULL,
    address      TEXT          NULL,
    notes        TEXT          NULL,
    is_active    BOOLEAN       NOT NULL DEFAULT TRUE,
    created_at   DATETIME(6)   NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at   DATETIME(6)   NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
    CONSTRAINT fk_supplier_store FOREIGN KEY (store_id) REFERENCES stores(id)
) ENGINE = InnoDB;

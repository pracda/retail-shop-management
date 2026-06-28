-- Products can now have a parent product (they are variants)
ALTER TABLE products
    ADD COLUMN parent_product_id BIGINT     NULL COMMENT 'NULL = standalone or parent; set = this is a variant',
    ADD COLUMN variant_name      VARCHAR(200) NULL COMMENT 'e.g. "Red / Large"',
    ADD CONSTRAINT fk_product_parent FOREIGN KEY (parent_product_id) REFERENCES products(id);

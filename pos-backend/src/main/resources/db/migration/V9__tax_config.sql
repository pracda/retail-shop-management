-- Store-level default tax rate (e.g. 0.13 = 13% VAT)
ALTER TABLE stores
    ADD COLUMN tax_rate DECIMAL(6,4) NOT NULL DEFAULT 0.0000
        COMMENT 'Fractional rate applied to taxable sales, e.g. 0.13 for 13%';

-- Per-product override; NULL means use the store default
ALTER TABLE products
    ADD COLUMN tax_rate DECIMAL(6,4) NULL
        COMMENT 'Override store tax_rate when set';

ALTER TABLE products
    ADD COLUMN is_taxable BOOLEAN NOT NULL DEFAULT TRUE
        COMMENT 'False = always tax-exempt regardless of rate';

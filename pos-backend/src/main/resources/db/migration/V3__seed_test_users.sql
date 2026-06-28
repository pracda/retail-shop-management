-- ============================================================
-- V3: Test credentials for development
--
-- Admin (email login):
--   email   : admin@mart.com
--   password: Admin@1234
--
-- Cashier (PIN login, store_id = 1):
--   email   : cashier@mart.com
--   password: Admin@1234
--   PIN     : 1234
-- ============================================================

-- Reset admin password to Admin@1234
UPDATE users
SET password_hash = '$2a$12$qFa5nTDtovlx2Sy8.IA2WOeyJHKm0sTmgn.d/vpjREOXzpCzQ7vlu'
WHERE email = 'admin@mart.com';

-- Insert test cashier (role_id 4 = CASHIER, store_id 1)
INSERT INTO users (
    store_id,
    first_name,
    last_name,
    email,
    password_hash,
    pin_hash,
    role_id,
    is_active,
    created_at,
    updated_at
) VALUES (
    1,
    'Test',
    'Cashier',
    'cashier@mart.com',
    '$2a$12$qFa5nTDtovlx2Sy8.IA2WOeyJHKm0sTmgn.d/vpjREOXzpCzQ7vlu',
    '$2a$12$pkBnoRxyDMrLwUvlyrXPSu/RGSAxBNbCmLMF5PoymCheW8ql7RisC',
    4,
    true,
    NOW(6),
    NOW(6)
);

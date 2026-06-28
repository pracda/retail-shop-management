INSERT INTO users (
    store_id,
    first_name,
    last_name,
    email,
    password_hash,
    role_id,
    is_active,
    created_at,
    updated_at
) VALUES (
    1,
    'System',
    'Admin',
    'admin@mart.com',
    '$2b$12$7IPf36Apjr7h1fPEgh138eBQBo38mWUWnWjbP0p2SOI8Gzm2wTDfq',
    1,
    true,
    NOW(6),
    NOW(6)
);

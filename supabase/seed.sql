-- Create a test user
-- Password is 'password123'
INSERT INTO auth.users (
    instance_id,
    id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
    recovery_sent_at,
    last_sign_in_at,
    raw_app_meta_data,
    raw_user_meta_data,
    created_at,
    updated_at,
    confirmation_token,
    email_change,
    email_change_token_new,
    recovery_token
) VALUES (
    '00000000-0000-0000-0000-000000000000',
    'd0d9c0e5-795b-4020-a65c-6715ac90538a',
    'authenticated',
    'authenticated',
    'test@example.com',
    extensions.crypt('password123', extensions.gen_salt('bf')),
    current_timestamp,
    current_timestamp,
    current_timestamp,
    '{"provider":"email","providers":["email"]}',
    '{}',
    current_timestamp,
    current_timestamp,
    '',
    '',
    '',
    ''
) ON CONFLICT (id) DO NOTHING;



-- Insert a test note owned by this user
INSERT INTO public.notes (
    user_id,
    title,
    content_json,
    content_plain,
    is_starred,
    course_code
) VALUES (
    'd0d9c0e5-795b-4020-a65c-6715ac90538a',
    'Welcome to Local Development 🚀',
    '{"root": {"children": [{"children": [{"detail": 0, "format": 0, "mode": "normal", "style": "", "text": "This is a test note seeded automatically. If you assume this, the database is working!", "type": "text", "version": 1}], "direction": "ltr", "format": "", "indent": 0, "type": "paragraph", "version": 1}], "direction": "ltr", "format": "", "indent": 0, "type": "root", "version": 1}}',
    'This is a test note seeded automatically. If you assume this, the database is working!',
    true,
    'SETUP-101'
);

-- Insert a test chat
INSERT INTO public.chats (
    user_id,
    title
) VALUES (
    'd0d9c0e5-795b-4020-a65c-6715ac90538a',
    'Test Chat Session'
);

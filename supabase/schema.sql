-- =============================================
-- YB News — Supabase Database Schema
-- Jalankan ini di Supabase SQL Editor
-- =============================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- =============================================
-- TABLE: users
-- =============================================
CREATE TABLE IF NOT EXISTS public.users (
    id UUID DEFAULT gen_random_uuid () PRIMARY KEY,
    full_name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    is_first_login BOOLEAN DEFAULT true NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- =============================================
-- TABLE: otp_tokens
-- =============================================
CREATE TABLE IF NOT EXISTS public.otp_tokens (
    id UUID DEFAULT gen_random_uuid () PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES public.users (id) ON DELETE CASCADE,
    otp_code TEXT NOT NULL,
    type TEXT NOT NULL CHECK (
        type IN ('login', 'reset_password')
    ),
    expires_at TIMESTAMPTZ NOT NULL,
    used BOOLEAN DEFAULT false NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_otp_tokens_user_id ON public.otp_tokens (user_id);

-- =============================================
-- TABLE: sessions (single-device enforcement)
-- =============================================
CREATE TABLE IF NOT EXISTS public.sessions (
    id UUID DEFAULT gen_random_uuid () PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES public.users (id) ON DELETE CASCADE,
    token_hash TEXT NOT NULL,
    device_info TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    CONSTRAINT sessions_user_id_unique UNIQUE (user_id)
);

-- =============================================
-- TABLE: likes
-- User bisa like sebuah artikel (berdasarkan URL)
-- =============================================
CREATE TABLE IF NOT EXISTS public.likes (
    id UUID DEFAULT gen_random_uuid () PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES public.users (id) ON DELETE CASCADE,
    article_url TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    CONSTRAINT likes_user_article_unique UNIQUE (user_id, article_url)
);

CREATE INDEX IF NOT EXISTS idx_likes_article_url ON public.likes (article_url);

CREATE INDEX IF NOT EXISTS idx_likes_user_id ON public.likes (user_id);

-- =============================================
-- TABLE: comments
-- User bisa komentar di artikel
-- =============================================
CREATE TABLE IF NOT EXISTS public.comments (
    id UUID DEFAULT gen_random_uuid () PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES public.users (id) ON DELETE CASCADE,
    article_url TEXT NOT NULL,
    content TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_comments_article_url ON public.comments (article_url);

CREATE INDEX IF NOT EXISTS idx_comments_user_id ON public.comments (user_id);

-- =============================================
-- TABLE: bookmarks
-- User bisa bookmark artikel
-- =============================================
CREATE TABLE IF NOT EXISTS public.bookmarks (
    id UUID DEFAULT gen_random_uuid () PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES public.users (id) ON DELETE CASCADE,
    article_url TEXT NOT NULL,
    article_data JSONB NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    CONSTRAINT bookmarks_user_article_unique UNIQUE (user_id, article_url)
);

CREATE INDEX IF NOT EXISTS idx_bookmarks_user_id ON public.bookmarks (user_id);

CREATE INDEX IF NOT EXISTS idx_bookmarks_article_url ON public.bookmarks (article_url);

-- =============================================
-- Disable RLS (kita pakai service_role key dari backend)
-- =============================================
ALTER TABLE public.users DISABLE ROW LEVEL SECURITY;

ALTER TABLE public.otp_tokens DISABLE ROW LEVEL SECURITY;

ALTER TABLE public.sessions DISABLE ROW LEVEL SECURITY;

ALTER TABLE public.likes DISABLE ROW LEVEL SECURITY;

ALTER TABLE public.comments DISABLE ROW LEVEL SECURITY;

ALTER TABLE public.bookmarks DISABLE ROW LEVEL SECURITY;
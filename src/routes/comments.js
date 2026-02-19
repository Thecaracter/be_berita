const express = require('express');
const supabase = require('../config/supabase');
const authMiddleware = require('../middleware/auth');

const router = express.Router();

// ─────────────────────────────────────────
// GET /api/comments?article_url=...&page=1
// Ambil komentar untuk satu artikel (publik, tidak perlu auth)
// ─────────────────────────────────────────
router.get('/', async (req, res, next) => {
    try {
        const { article_url, page = 1, pageSize = 20 } = req.query;

        if (!article_url) {
            return res.status(400).json({ error: 'article_url wajib diisi.' });
        }

        const from = (parseInt(page) - 1) * parseInt(pageSize);
        const to = from + parseInt(pageSize) - 1;

        const { data: comments, error, count } = await supabase
            .from('comments')
            .select(
                `
        id,
        content,
        created_at,
        updated_at,
        users:user_id ( id, full_name )
      `,
                { count: 'exact' }
            )
            .eq('article_url', article_url)
            .order('created_at', { ascending: false })
            .range(from, to);

        if (error) throw error;

        return res.json({
            article_url,
            total: count || 0,
            page: parseInt(page),
            pageSize: parseInt(pageSize),
            comments,
        });
    } catch (err) {
        next(err);
    }
});

// ─────────────────────────────────────────
// POST /api/comments — butuh auth
// Body: { article_url, content }
// ─────────────────────────────────────────
router.post('/', authMiddleware, async (req, res, next) => {
    try {
        const { article_url, content } = req.body;

        if (!article_url || !content) {
            return res.status(400).json({ error: 'article_url dan content wajib diisi.' });
        }

        if (content.trim().length < 1) {
            return res.status(400).json({ error: 'Komentar tidak boleh kosong.' });
        }

        if (content.length > 1000) {
            return res.status(400).json({ error: 'Komentar maksimal 1000 karakter.' });
        }

        const { data: comment, error } = await supabase
            .from('comments')
            .insert({
                user_id: req.user.id,
                article_url,
                content: content.trim(),
            })
            .select(
                `
        id,
        content,
        created_at,
        updated_at,
        users:user_id ( id, full_name )
      `
            )
            .single();

        if (error) throw error;

        return res.status(201).json({ message: 'Komentar berhasil ditambahkan.', comment });
    } catch (err) {
        next(err);
    }
});

// ─────────────────────────────────────────
// PUT /api/comments/:id — edit komentar sendiri
// Body: { content }
// ─────────────────────────────────────────
router.put('/:id', authMiddleware, async (req, res, next) => {
    try {
        const { id } = req.params;
        const { content } = req.body;

        if (!content || content.trim().length < 1) {
            return res.status(400).json({ error: 'Komentar tidak boleh kosong.' });
        }

        if (content.length > 1000) {
            return res.status(400).json({ error: 'Komentar maksimal 1000 karakter.' });
        }

        // Pastikan komentar milik user ini
        const { data: existing } = await supabase
            .from('comments')
            .select('id, user_id')
            .eq('id', id)
            .single();

        if (!existing) {
            return res.status(404).json({ error: 'Komentar tidak ditemukan.' });
        }

        if (existing.user_id !== req.user.id) {
            return res.status(403).json({ error: 'Kamu tidak bisa mengedit komentar orang lain.' });
        }

        const { data: comment, error } = await supabase
            .from('comments')
            .update({ content: content.trim(), updated_at: new Date().toISOString() })
            .eq('id', id)
            .select(
                `
        id,
        content,
        created_at,
        updated_at,
        users:user_id ( id, full_name )
      `
            )
            .single();

        if (error) throw error;

        return res.json({ message: 'Komentar berhasil diupdate.', comment });
    } catch (err) {
        next(err);
    }
});

// ─────────────────────────────────────────
// DELETE /api/comments/:id — hapus komentar sendiri
// ─────────────────────────────────────────
router.delete('/:id', authMiddleware, async (req, res, next) => {
    try {
        const { id } = req.params;

        // Pastikan komentar milik user ini
        const { data: existing } = await supabase
            .from('comments')
            .select('id, user_id')
            .eq('id', id)
            .single();

        if (!existing) {
            return res.status(404).json({ error: 'Komentar tidak ditemukan.' });
        }

        if (existing.user_id !== req.user.id) {
            return res.status(403).json({ error: 'Kamu tidak bisa menghapus komentar orang lain.' });
        }

        await supabase.from('comments').delete().eq('id', id);

        return res.json({ message: 'Komentar berhasil dihapus.' });
    } catch (err) {
        next(err);
    }
});

module.exports = router;

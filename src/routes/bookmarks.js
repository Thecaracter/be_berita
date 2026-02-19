const express = require('express');
const supabase = require('../config/supabase');
const authMiddleware = require('../middleware/auth');

const router = express.Router();

router.use(authMiddleware);

router.get('/', async (req, res, next) => {
    try {
        const { data, error } = await supabase
            .from('bookmarks')
            .select('id, article_url, article_data, created_at')
            .eq('user_id', req.user.id)
            .order('created_at', { ascending: false });

        if (error) throw error;

        return res.json({ bookmarks: data });
    } catch (err) {
        next(err);
    }
});

router.post('/', async (req, res, next) => {
    try {
        const { article_url, article_data } = req.body;

        if (!article_url || !article_data) {
            return res.status(400).json({ error: 'article_url and article_data are required.' });
        }

        const { data, error } = await supabase
            .from('bookmarks')
            .insert({
                user_id: req.user.id,
                article_url,
                article_data,
            })
            .select('id, article_url, article_data, created_at')
            .single();

        if (error) {
            // Unique constraint = already bookmarked
            if (error.code === '23505') {
                return res.status(409).json({ error: 'Article already bookmarked.' });
            }
            throw error;
        }

        return res.status(201).json({ message: 'Article bookmarked.', bookmark: data });
    } catch (err) {
        next(err);
    }
});

router.delete('/:id', async (req, res, next) => {
    try {
        const { id } = req.params;

        const { data, error } = await supabase
            .from('bookmarks')
            .delete()
            .eq('id', id)
            .eq('user_id', req.user.id)
            .select('id')
            .single();

        if (error || !data) {
            return res.status(404).json({ error: 'Bookmark not found.' });
        }

        return res.json({ message: 'Bookmark removed.' });
    } catch (err) {
        next(err);
    }
});

router.delete('/by-url', async (req, res, next) => {
    try {
        const { article_url } = req.body;

        if (!article_url) {
            return res.status(400).json({ error: 'article_url is required.' });
        }

        const { data, error } = await supabase
            .from('bookmarks')
            .delete()
            .eq('article_url', article_url)
            .eq('user_id', req.user.id)
            .select('id')
            .single();

        if (error || !data) {
            return res.status(404).json({ error: 'Bookmark not found.' });
        }

        return res.json({ message: 'Bookmark removed.' });
    } catch (err) {
        next(err);
    }
});

module.exports = router;

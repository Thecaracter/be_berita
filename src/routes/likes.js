const express = require('express');
const supabase = require('../config/supabase');
const authMiddleware = require('../middleware/auth');

const router = express.Router();

router.use(authMiddleware);

router.get('/', async (req, res, next) => {
    try {
        const { article_url } = req.query;

        if (!article_url) {
            return res.status(400).json({ error: 'article_url wajib diisi.' });
        }

        const { count: totalLikes } = await supabase
            .from('likes')
            .select('id', { count: 'exact', head: true })
            .eq('article_url', article_url);

        const { data: userLike } = await supabase
            .from('likes')
            .select('id')
            .eq('user_id', req.user.id)
            .eq('article_url', article_url)
            .single();

        return res.json({
            article_url,
            total_likes: totalLikes || 0,
            is_liked: !!userLike,
        });
    } catch (err) {
        next(err);
    }
});

router.post('/', async (req, res, next) => {
    try {
        const { article_url } = req.body;

        if (!article_url) {
            return res.status(400).json({ error: 'article_url wajib diisi.' });
        }

        const { data: existing } = await supabase
            .from('likes')
            .select('id')
            .eq('user_id', req.user.id)
            .eq('article_url', article_url)
            .single();

        if (existing) {
            await supabase.from('likes').delete().eq('id', existing.id);

            const { count: total } = await supabase
                .from('likes')
                .select('id', { count: 'exact', head: true })
                .eq('article_url', article_url);

            return res.json({ message: 'Like removed.', is_liked: false, total_likes: total || 0 });
        }

        await supabase.from('likes').insert({ user_id: req.user.id, article_url });

        const { count: total } = await supabase
            .from('likes')
            .select('id', { count: 'exact', head: true })
            .eq('article_url', article_url);

        return res.status(201).json({ message: 'Liked.', is_liked: true, total_likes: total || 0 });
    } catch (err) {
        next(err);
    }
});

module.exports = router;

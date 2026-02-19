const express = require('express');
const axios = require('axios');
const NodeCache = require('node-cache');

const router = express.Router();
const cache = new NodeCache({ stdTTL: 300 });

const NEWSAPI_BASE = 'https://newsapi.org/v2';
const SUPPORTED_CATEGORIES = ['technology', 'business', 'health', 'entertainment', 'sports', 'science'];

const CATEGORY_KEYWORDS = {
    technology: 'technology OR tech OR AI OR software',
    business: 'business OR economy OR market OR finance',
    health: 'health OR medicine OR covid OR wellness',
    entertainment: 'entertainment OR movie OR music OR celebrity',
    sports: 'sports OR football OR basketball OR soccer',
    science: 'science OR space OR nasa OR research',
};

function getApiKey() {
    return process.env.NEWSAPI_KEY;
}

function handleNewsApiError(error, res) {
    if (error.response) {
        const { status, data } = error.response;
        if (status === 401) return res.status(500).json({ error: 'News API key tidak valid atau belum diset.' });
        if (status === 429) return res.status(503).json({ error: 'News API rate limit. Coba beberapa saat lagi.' });
        return res.status(status).json({ error: data.message || 'News API error.' });
    }
    if (error.code === 'ENOTFOUND' || error.code === 'ETIMEDOUT') {
        return res.status(503).json({ error: 'Tidak bisa terhubung ke layanan berita. Periksa koneksi internet.' });
    }
    return res.status(500).json({ error: 'Gagal mengambil berita.' });
}

function getFromDate(daysAgo = 30) {
    const date = new Date();
    date.setDate(date.getDate() - daysAgo);
    return date.toISOString().split('T')[0];
}

router.get('/', async (req, res) => {
    const { page = 1, pageSize = 20, sortBy = 'publishedAt' } = req.query;
    const cacheKey = `everything-${page}-${pageSize}-${sortBy}`;

    const cached = cache.get(cacheKey);
    if (cached) return res.json(cached);

    try {
        const { data } = await axios.get(`${NEWSAPI_BASE}/everything`, {
            params: {
                q: 'world OR global OR news OR breaking',
                from: getFromDate(30),
                sortBy,
                language: 'en',
                page: parseInt(page),
                pageSize: Math.min(parseInt(pageSize), 100),
                apiKey: getApiKey(),
            },
        });

        const result = {
            totalResults: data.totalResults,
            page: parseInt(page),
            pageSize: parseInt(pageSize),
            sortBy,
            articles: data.articles.filter((a) => a.title !== '[Removed]' && a.urlToImage),
        };

        cache.set(cacheKey, result);
        return res.json(result);
    } catch (err) {
        return handleNewsApiError(err, res);
    }
});

router.get('/search', async (req, res) => {
    const { q, page = 1, pageSize = 20, sortBy = 'publishedAt' } = req.query;

    if (!q || q.trim() === '') {
        return res.status(400).json({ error: 'Parameter "q" wajib diisi.' });
    }

    const cacheKey = `search-${q}-${page}-${pageSize}-${sortBy}`;
    const cached = cache.get(cacheKey);
    if (cached) return res.json(cached);

    try {
        const { data } = await axios.get(`${NEWSAPI_BASE}/everything`, {
            params: {
                q: q.trim(),
                from: getFromDate(30),
                sortBy,
                language: 'en',
                page: parseInt(page),
                pageSize: Math.min(parseInt(pageSize), 100),
                apiKey: getApiKey(),
            },
        });

        const result = {
            totalResults: data.totalResults,
            page: parseInt(page),
            pageSize: parseInt(pageSize),
            query: q.trim(),
            articles: data.articles.filter((a) => a.title !== '[Removed]'),
        };

        cache.set(cacheKey, result);
        return res.json(result);
    } catch (err) {
        return handleNewsApiError(err, res);
    }
});

router.get('/categories', (req, res) => {
    res.json({ categories: SUPPORTED_CATEGORIES });
});

router.get('/category/:category', async (req, res) => {
    const { category } = req.params;
    const { page = 1, pageSize = 20, sortBy = 'publishedAt' } = req.query;
    const cat = category.toLowerCase();

    if (!SUPPORTED_CATEGORIES.includes(cat)) {
        return res.status(400).json({
            error: `Kategori tidak valid. Pilihan: ${SUPPORTED_CATEGORIES.join(', ')}`,
        });
    }

    const cacheKey = `category-${cat}-${page}-${pageSize}-${sortBy}`;
    const cached = cache.get(cacheKey);
    if (cached) return res.json(cached);

    try {
        const { data } = await axios.get(`${NEWSAPI_BASE}/everything`, {
            params: {
                q: CATEGORY_KEYWORDS[cat],
                from: getFromDate(30),
                sortBy,
                language: 'en',
                page: parseInt(page),
                pageSize: Math.min(parseInt(pageSize), 100),
                apiKey: getApiKey(),
            },
        });

        const result = {
            totalResults: data.totalResults,
            page: parseInt(page),
            pageSize: parseInt(pageSize),
            category: cat,
            articles: data.articles.filter((a) => a.title !== '[Removed]'),
        };

        cache.set(cacheKey, result);
        return res.json(result);
    } catch (err) {
        return handleNewsApiError(err, res);
    }
});

module.exports = router;

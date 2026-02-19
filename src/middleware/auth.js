const { verifyAccessToken } = require('../utils/jwt');
const supabase = require('../config/supabase');
const crypto = require('crypto');

async function authMiddleware(req, res, next) {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ error: 'Missing or invalid authorization header.' });
        }

        const token = authHeader.split(' ')[1];
        let decoded;

        try {
            decoded = verifyAccessToken(token);
        } catch (err) {
            if (err.name === 'TokenExpiredError') {
                return res.status(401).json({ error: 'Access token expired.', code: 'TOKEN_EXPIRED' });
            }
            return res.status(401).json({ error: 'Invalid access token.' });
        }

        // Check if session exists and matches token hash
        const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

        const { data: session, error } = await supabase
            .from('sessions')
            .select('id, token_hash')
            .eq('user_id', decoded.id)
            .single();

        if (error || !session) {
            return res.status(401).json({ error: 'Session not found. Please log in again.', code: 'SESSION_NOT_FOUND' });
        }

        if (session.token_hash !== tokenHash) {
            return res.status(401).json({ error: 'Session invalidated. Another device has logged in.', code: 'SESSION_INVALIDATED' });
        }

        req.user = { id: decoded.id, email: decoded.email, full_name: decoded.full_name };
        next();
    } catch (err) {
        next(err);
    }
}

module.exports = authMiddleware;

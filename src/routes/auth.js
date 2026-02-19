const express = require('express');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const rateLimit = require('express-rate-limit');
const supabase = require('../config/supabase');
const { signAccessToken } = require('../utils/jwt');
const { createOTP, verifyOTP, canResendOTP } = require('../utils/otp');
const { sendOTPEmail } = require('../utils/email');
const authMiddleware = require('../middleware/auth');

const router = express.Router();

// --- Rate Limiters ---
const otpLimiter = rateLimit({
    windowMs: 3 * 60 * 1000, // 3 minutes
    max: 1,
    message: { error: 'Please wait before requesting a new OTP.' },
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => req.body.email || req.ip,
});

const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 10,
    message: { error: 'Too many login attempts. Try again later.' },
});

// ─────────────────────────────────────────
// POST /api/auth/register
// ─────────────────────────────────────────
router.post('/register', async (req, res, next) => {
    try {
        const { full_name, email, password, confirm_password } = req.body;

        // Validation
        if (!full_name || !email || !password || !confirm_password) {
            return res.status(400).json({ error: 'All fields are required.' });
        }

        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return res.status(400).json({ error: 'Invalid email format.' });
        }

        // Password: min 8 chars, at least 1 letter and 1 number
        const passwordRegex = /^(?=.*[A-Za-z])(?=.*\d)[A-Za-z\d\W]{8,}$/;
        if (!passwordRegex.test(password)) {
            return res.status(400).json({
                error: 'Password must be at least 8 characters and contain letters and numbers.',
            });
        }

        if (password !== confirm_password) {
            return res.status(400).json({ error: 'Passwords do not match.' });
        }

        // Check email taken
        const { data: existing } = await supabase
            .from('users')
            .select('id')
            .eq('email', email.toLowerCase())
            .single();

        if (existing) {
            return res.status(409).json({ error: 'Email already registered.' });
        }

        const password_hash = await bcrypt.hash(password, 12);

        const { data: user, error } = await supabase
            .from('users')
            .insert({
                full_name: full_name.trim(),
                email: email.toLowerCase(),
                password_hash,
                is_first_login: true,
            })
            .select('id, full_name, email, created_at')
            .single();

        if (error) throw error;

        return res.status(201).json({
            message: 'Registration successful. Please log in.',
            user,
        });
    } catch (err) {
        next(err);
    }
});

// ─────────────────────────────────────────
// POST /api/auth/login
// Returns { needsOtp: true } if first login (sends OTP)
// Returns { accessToken, user } if not first login (skip OTP)
// ─────────────────────────────────────────
router.post('/login', loginLimiter, async (req, res, next) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({ error: 'Email and password are required.' });
        }

        console.log('🔍 Login attempt:', email);

        const { data: user, error } = await supabase
            .from('users')
            .select('id, full_name, email, password_hash, is_first_login')
            .eq('email', email.toLowerCase())
            .single();

        if (error) {
            console.error('❌ Supabase error:', error);
            return res.status(500).json({ error: 'Database error. Please try again.' });
        }

        if (!user) {
            return res.status(401).json({ error: 'Invalid email or password.' });
        }

        console.log('✅ User found:', user.email);

        const passwordMatch = await bcrypt.compare(password, user.password_hash);
        if (!passwordMatch) {
            console.log('❌ Password mismatch');
            return res.status(401).json({ error: 'Invalid email or password.' });
        }

        console.log('✅ Password match');

        // Check if first login
        if (user.is_first_login) {
            // First login: send OTP
            console.log('📧 First login detected, creating OTP...');
            const otp = await createOTP(user.id, 'login');
            console.log('✅ OTP created:', otp);

            console.log('📨 Sending OTP email to:', user.email);
            await sendOTPEmail({
                to: user.email,
                name: user.full_name,
                otp,
                type: 'login',
            });
            console.log('✅ OTP email sent');

            return res.status(200).json({
                message: 'OTP sent to your email.',
                needsOtp: true,
                userId: user.id,
                isFirstLogin: true,
            });
        } else {
            // Not first login: bypass OTP, create session and return token directly
            console.log('✅ Login successful (not first login)');

            const tokenPayload = { id: user.id, email: user.email, full_name: user.full_name };
            const accessToken = signAccessToken(tokenPayload);

            // Store session hash
            const tokenHash = crypto.createHash('sha256').update(accessToken).digest('hex');
            const deviceInfo = req.headers['user-agent'] || 'Unknown';

            await supabase.from('sessions').upsert(
                { user_id: user.id, token_hash: tokenHash, device_info: deviceInfo },
                { onConflict: 'user_id' }
            );

            return res.status(200).json({
                message: 'Login successful.',
                accessToken,
                user: {
                    id: user.id,
                    email: user.email,
                    full_name: user.full_name,
                },
            });
        }
    } catch (err) {
        next(err);
    }
});

// ─────────────────────────────────────────
// POST /api/auth/verify-otp
// ─────────────────────────────────────────
router.post('/verify-otp', async (req, res, next) => {
    try {
        const { userId, otp, type = 'login' } = req.body;

        if (!userId || !otp) {
            return res.status(400).json({ error: 'userId and otp are required.' });
        }

        if (otp.length !== 4 || !/^\d{4}$/.test(otp)) {
            return res.status(400).json({ error: 'OTP must be 4 digits.' });
        }

        const result = await verifyOTP(userId, otp, type);

        if (!result.valid) {
            const status = result.reason.includes('expired') ? 410 : 400;
            return res.status(status).json({ error: result.reason });
        }

        // Fetch user data
        const { data: user, error } = await supabase
            .from('users')
            .select('id, email, full_name, is_first_login')
            .eq('id', userId)
            .single();

        if (error || !user) {
            return res.status(404).json({ error: 'User not found.' });
        }

        if (type === 'login') {
            // Update is_first_login to false if true
            if (user.is_first_login) {
                const { error: updateError } = await supabase
                    .from('users')
                    .update({ is_first_login: false, updated_at: new Date().toISOString() })
                    .eq('id', user.id);

                if (updateError) {
                    console.error('❌ Error updating is_first_login:', updateError);
                    throw updateError;
                }
                console.log('✅ is_first_login updated to false for user:', user.id);
            }

            // Create access token
            const tokenPayload = { id: user.id, email: user.email, full_name: user.full_name };
            const accessToken = signAccessToken(tokenPayload);

            // Store session hash (single-device: UPSERT replaces old session)
            const tokenHash = crypto.createHash('sha256').update(accessToken).digest('hex');
            const deviceInfo = req.headers['user-agent'] || 'Unknown';

            await supabase.from('sessions').upsert(
                { user_id: user.id, token_hash: tokenHash, device_info: deviceInfo },
                { onConflict: 'user_id' }
            );

            return res.status(200).json({
                message: 'Login successful.',
                accessToken,
                user: {
                    id: user.id,
                    email: user.email,
                    full_name: user.full_name,
                },
            });
        }

        // For reset_password type — return a short-lived reset token
        const resetToken = signAccessToken({ id: user.id, purpose: 'reset_password' });
        return res.status(200).json({ message: 'OTP verified.', resetToken });
    } catch (err) {
        next(err);
    }
});

// ─────────────────────────────────────────
// POST /api/auth/resend-otp
// ─────────────────────────────────────────
router.post('/resend-otp', async (req, res, next) => {
    try {
        const { userId, type = 'login' } = req.body;

        if (!userId) {
            return res.status(400).json({ error: 'userId is required.' });
        }

        const { canResend, remainingSeconds } = await canResendOTP(userId, type);

        if (!canResend) {
            return res.status(429).json({
                error: `Please wait before requesting a new OTP.`,
                remainingSeconds,
            });
        }

        const { data: user, error } = await supabase
            .from('users')
            .select('email, full_name')
            .eq('id', userId)
            .single();

        if (error || !user) {
            return res.status(404).json({ error: 'User not found.' });
        }

        const otp = await createOTP(userId, type);
        await sendOTPEmail({ to: user.email, name: user.full_name, otp, type });

        return res.status(200).json({ message: 'OTP resent successfully.' });
    } catch (err) {
        next(err);
    }
});

// ─────────────────────────────────────────
// POST /api/auth/logout
// ─────────────────────────────────────────
router.post('/logout', authMiddleware, async (req, res, next) => {
    try {
        await supabase.from('sessions').delete().eq('user_id', req.user.id);
        return res.status(200).json({ message: 'Logged out successfully.' });
    } catch (err) {
        next(err);
    }
});

// ─────────────────────────────────────────
// DELETE /api/auth/account
// Delete user account (cascade deletes bookmarks, comments, likes, etc)
// ─────────────────────────────────────────
router.delete('/account', authMiddleware, async (req, res, next) => {
    try {
        const userId = req.user.id;

        // Delete user (this will cascade delete all related data)
        const { error } = await supabase
            .from('users')
            .delete()
            .eq('id', userId);

        if (error) {
            console.error('❌ Error deleting user account:', error);
            throw error;
        }

        console.log('✅ User account deleted:', userId);

        return res.status(200).json({ 
            message: 'Account deleted successfully. All your data (bookmarks, comments, likes) have been removed.' 
        });
    } catch (err) {
        next(err);
    }
});

// ─────────────────────────────────────────
// GET /api/auth/me
// ─────────────────────────────────────────
router.get('/me', authMiddleware, async (req, res, next) => {
    try {
        const { data: user, error } = await supabase
            .from('users')
            .select('id, full_name, email, is_first_login, created_at')
            .eq('id', req.user.id)
            .single();

        if (error || !user) {
            return res.status(404).json({ error: 'User not found.' });
        }

        return res.status(200).json({ user });
    } catch (err) {
        next(err);
    }
});

// ─────────────────────────────────────────
// POST /api/auth/forgot-password
// ─────────────────────────────────────────
router.post('/forgot-password', otpLimiter, async (req, res, next) => {
    try {
        const { email } = req.body;

        if (!email) {
            return res.status(400).json({ error: 'Email is required.' });
        }

        const { data: user } = await supabase
            .from('users')
            .select('id, full_name, email')
            .eq('email', email.toLowerCase())
            .single();

        // Always return success to prevent email enumeration
        if (!user) {
            return res.status(200).json({
                message: 'If this email is registered, an OTP has been sent.',
                userId: null,
            });
        }

        const otp = await createOTP(user.id, 'reset_password');
        await sendOTPEmail({ to: user.email, name: user.full_name, otp, type: 'reset_password' });

        return res.status(200).json({
            message: 'OTP sent to your email.',
            userId: user.id,
        });
    } catch (err) {
        next(err);
    }
});

// ─────────────────────────────────────────
// POST /api/auth/reset-password
// ─────────────────────────────────────────
router.post('/reset-password', async (req, res, next) => {
    try {
        const { resetToken, newPassword, confirmPassword } = req.body;

        if (!resetToken || !newPassword || !confirmPassword) {
            return res.status(400).json({ error: 'All fields are required.' });
        }

        if (newPassword !== confirmPassword) {
            return res.status(400).json({ error: 'Passwords do not match.' });
        }

        const passwordRegex = /^(?=.*[A-Za-z])(?=.*\d)[A-Za-z\d\W]{8,}$/;
        if (!passwordRegex.test(newPassword)) {
            return res.status(400).json({
                error: 'Password must be at least 8 characters and contain letters and numbers.',
            });
        }

        const { verifyAccessToken } = require('../utils/jwt');
        let decoded;
        try {
            decoded = verifyAccessToken(resetToken);
        } catch {
            return res.status(401).json({ error: 'Invalid or expired reset token.' });
        }

        if (decoded.purpose !== 'reset_password') {
            return res.status(401).json({ error: 'Invalid reset token.' });
        }

        const password_hash = await bcrypt.hash(newPassword, 12);
        const { error } = await supabase
            .from('users')
            .update({ password_hash, updated_at: new Date().toISOString() })
            .eq('id', decoded.id);

        if (error) throw error;

        // Invalidate all sessions
        await supabase.from('sessions').delete().eq('user_id', decoded.id);

        return res.status(200).json({ message: 'Password reset successfully. Please log in.' });
    } catch (err) {
        next(err);
    }
});

module.exports = router;

const supabase = require('../config/supabase');

const OTP_EXPIRY_MINUTES = 3;

function generateOTP() {
    return Math.floor(Math.random() * 10000).toString().padStart(4, '0');
}

async function createOTP(userId, type = 'login') {
    await supabase
        .from('otp_tokens')
        .update({ used: true })
        .eq('user_id', userId)
        .eq('type', type)
        .eq('used', false);

    const otp = generateOTP();
    const expiresAt = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000).toISOString();

    const { error } = await supabase.from('otp_tokens').insert({
        user_id: userId,
        otp_code: otp,
        type,
        expires_at: expiresAt,
        used: false,
    });

    if (error) throw new Error('Failed to store OTP: ' + error.message);

    return otp;
}

async function verifyOTP(userId, code, type = 'login') {
    console.log(`🔍 verifyOTP - userId: ${userId}, code: ${code}, type: ${type}`);
    
    const { data: tokens, error } = await supabase
        .from('otp_tokens')
        .select('*')
        .eq('user_id', userId)
        .eq('type', type)
        .eq('used', false)
        .order('created_at', { ascending: false })
        .limit(1);

    console.log(`🔍 Query error: ${error}`);
    console.log(`🔍 Found tokens:`, tokens);

    if (error || !tokens || tokens.length === 0) {
        console.log(`❌ No active OTP found for userId: ${userId}, type: ${type}`);
        return { valid: false, reason: 'No active OTP found. Please request a new one.' };
    }

    const token = tokens[0];
    console.log(`✅ Token found:`, { id: token.id, otp_code: token.otp_code, expires_at: token.expires_at, used: token.used });

    // Check expiry
    if (new Date() > new Date(token.expires_at)) {
        console.log(`❌ OTP expired`);
        return { valid: false, reason: 'OTP expired, please request a new one.' };
    }

    console.log(`🔍 Comparing: "${token.otp_code.toUpperCase()}" vs "${code.toUpperCase()}"`);
    if (token.otp_code.toUpperCase() !== code.toUpperCase()) {
        console.log(`❌ OTP code mismatch`);
        return { valid: false, reason: 'Invalid OTP code.' };
    }

    console.log(`✅ OTP verified, marking as used`);
    await supabase.from('otp_tokens').update({ used: true }).eq('id', token.id);

    return { valid: true };
}

async function canResendOTP(userId, type = 'login') {
    const cooldownMs = 3 * 60 * 1000;

    const { data: tokens } = await supabase
        .from('otp_tokens')
        .select('created_at')
        .eq('user_id', userId)
        .eq('type', type)
        .order('created_at', { ascending: false })
        .limit(1);

    if (!tokens || tokens.length === 0) return { canResend: true };

    const lastCreated = new Date(tokens[0].created_at);
    const elapsed = Date.now() - lastCreated.getTime();

    if (elapsed < cooldownMs) {
        const remaining = Math.ceil((cooldownMs - elapsed) / 1000);
        return { canResend: false, remainingSeconds: remaining };
    }

    return { canResend: true };
}

module.exports = { generateOTP, createOTP, verifyOTP, canResendOTP };

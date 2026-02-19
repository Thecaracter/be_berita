function errorHandler(err, req, res, next) {
    console.error('[ERROR]', err.message || err);

    const statusCode = err.statusCode || 500;
    const message = err.expose
        ? err.message
        : statusCode === 500
            ? 'Internal server error.'
            : err.message;

    res.status(statusCode).json({ error: message });
}

module.exports = errorHandler;

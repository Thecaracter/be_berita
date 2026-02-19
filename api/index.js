/**
 * Vercel serverless entry point.
 * Vercel's @vercel/node adapter wraps the Express app as a serverless function.
 */
const app = require('../src/app');

module.exports = app;

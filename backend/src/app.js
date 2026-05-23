const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
require('dotenv').config();

const app = express();
const logger = require('./services/loggerService');
const ApiResponse = require('./utils/apiResponse');

// 1. Helmet: Strict Content Security Policy (CSP) & Browser Headers
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'", "'unsafe-inline'"],
            styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
            fontSrc: ["'self'", "https://fonts.gstatic.com"],
            imgSrc: ["'self'", "data:", "https://*"],
            connectSrc: ["'self'", "https://*"],
            objectSrc: ["'none'"],
            upgradeInsecureRequests: [],
        },
    },
    crossOriginEmbedderPolicy: false,
    crossOriginResourcePolicy: { policy: "cross-origin" }
}));

// 2. Secure CORS: Dynamic Allowed Origins Whitelist
const allowedOrigins = process.env.ALLOWED_ORIGINS
    ? process.env.ALLOWED_ORIGINS.split(',').map(o => o.trim())
    : [];

app.use(cors({
    origin: (origin, callback) => {
        if (!origin) return callback(null, true); // Allow requests with no origin (e.g. mobile app, server-to-server)
        const isDev = process.env.NODE_ENV === 'development';
        const isLocal = origin.startsWith('http://localhost') || origin.startsWith('http://127.0.0.1');
        if ((isDev && isLocal) || allowedOrigins.includes(origin)) {
            callback(null, true);
        } else {
            logger.warn(`[CORS] Blocked request from origin: ${origin}`);
            callback(new Error('Not allowed by CORS'));
        }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-ID']
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 3. Structured Request Observability
const loggingMiddleware = require('./middlewares/loggingMiddleware');
app.use(loggingMiddleware);

const { apiLimiter, authLimiter } = require('./middlewares/rateLimiter');

// Apply Redis-backed distributed rate limiting
app.use('/api/', apiLimiter);
app.use('/api/users/', authLimiter);

// Basic health check route
app.get('/health', (req, res) => {
    ApiResponse.success(res, 'TrendPulse API is running', { status: 'ok' });
});

const trendRoutes = require('./routes/trendRoutes');
const aiChatRoutes = require('./routes/aiChatRoutes');
const userRoutes = require('./routes/userRoutes');
const notificationRoutes = require('./routes/notificationRoutes');
const systemRoutes = require('./routes/systemRoutes');

// Task 7: Bull Board Queue Monitoring Dashboard
const { createBullBoard } = require('@bull-board/api');
const { BullMQAdapter } = require('@bull-board/api/bullMQAdapter');
const { ExpressAdapter } = require('@bull-board/express');
const { aiEnrichmentQueue, trendQueue } = require('./config/queue');

const serverAdapter = new ExpressAdapter();
serverAdapter.setBasePath('/admin/queues');

createBullBoard({
    queues: [
        new BullMQAdapter(aiEnrichmentQueue),
        new BullMQAdapter(trendQueue)
    ],
    serverAdapter
});

// Secure admin route with basic auth check
app.use('/admin/queues', (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || authHeader !== `Bearer ${process.env.ADMIN_SECRET || 'trendpulse-admin-2026'}`) {
        return ApiResponse.error(res, 'Unauthorized', null, 401);
    }
    next();
}, serverAdapter.getRouter());

app.use('/api/trends', trendRoutes);
app.use('/api/ai', aiChatRoutes);
app.use('/api/users', userRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/system', systemRoutes);

// Onboarding endpoint
const { verifyToken } = require('./middlewares/authMiddleware');
const validate = require('./middlewares/validate');
const { onboardUserSchema } = require('./validators/userValidators');
const userOnboardingService = require('./services/userOnboardingService');
app.post('/api/users/onboard', verifyToken, validate(onboardUserSchema), async (req, res, next) => {
    try {
        const userId = req.user.uid;
        const { categories } = req.body;
        await userOnboardingService.processOnboarding(userId, categories);
        ApiResponse.success(res, 'Onboarding complete');
    } catch (error) {
        next(error);
    }
});

// Standardized Global Error Handling Middleware (with production masking)
app.use((err, req, res, next) => {
    logger.error('Unhandled Server Error: %o', { error: err.message, stack: err.stack, path: req.path });
    const statusCode = err.status || err.statusCode || 500;
    const message = err.message || 'Internal Server Error';
    return ApiResponse.error(res, message, err, statusCode);
});

module.exports = app;

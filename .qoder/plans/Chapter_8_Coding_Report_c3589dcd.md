# Chapter 8: Coding — Trend Pulse Report Generation Plan

## Task 1: Prepare Report Infrastructure
- Install `pdfkit` (or use a markdown-to-PDF approach) for PDF generation
- Create the report generation script at `d:\AITrendTracker\generate_chapter8.js`
- Set up cover page, table of contents, page numbering, and consistent typography

## Task 2: Write Section 8.1 — Frontend Code
### 8.1 Introduction
- Write a brief professional intro describing the React Native + TypeScript mobile architecture

### 8.1.1 App.tsx
- Cleaned code snippet showing navigation container, Redux Provider, PersistGate, socket initialization, app state lifecycle
- Concise explanation of the app shell architecture

### 8.1.2 Dashboard & Analytics Screens
- **HomeScreen.tsx**: Redux-RTK Query integration, pulse card, featured trends carousel, rising fast list, responsive mobile UI
- **TrendAnalysisScreen.tsx**: AI analysis metrics display (sentiment, virality), key drivers, AI prediction card
- **TrendGraphScreen.tsx**: Pseudo-bar chart rendering, analytics dashboard, time filters, network distribution, system alerts
- **GeoHeatmapScreen.tsx**: react-native-maps Heatmap layer, marker clustering, lazy rendering, stream throttling
- Cleaned code snippets for each, focusing on business logic not styles

### 8.1.3 AI Chat & Search Features
- **AIChatScreen.tsx**: Message threading, Gemini API communication via backend proxy, conversation history management, typing indicator
- **SearchScreen.tsx**: Debounced search with API fetch, recent searches chips, suggested topics, result rendering
- **TrendingScreen.tsx**: Explore feed with ranked trending cards, rank badges, navigation to trend detail
- **AuthNavigator.tsx**: Stack navigator configuration, auth flow and main app screens
- **apiSlice.ts**: RTK Query endpoint definitions with tag-based caching
- **socketService.ts**: Socket.IO client with 500ms batched Redux dispatch, event webhooks

## Task 3: Write Section 8.2 — Backend Code
### 8.2 Introduction
- Brief intro describing Node.js + Express.js + MongoDB backend architecture

### 8.2.1 Server Initialization (server.js + app.js)
- **server.js**: MongoDB connection, HTTP server creation, Socket.IO initialization, cron job for geo trend scanning, BullMQ worker startup
- **app.js**: Express middleware stack (helmet, cors, rate limiting), route registration, Bull Board admin dashboard, error handling middleware
- Cleaned production-quality code

### 8.2.2 Database Models & APIs
- **Trend.js**: Full MongoDB schema with scoring, analysis, geography, predictions, cross-platform sources, clustering, anomaly detection fields; compound indexes
- **TrendHistory.js**: Time-series schema for analytics
- **User.js**: User schema with geo-location, preferences, interests
- **UserActivity.js**: Micro-interaction tracking with weighted scoring (click:1, like:2, bookmark:5, share:7), 7-day rolling window aggregation, TTL index
- **Notification.js**: Alert schema with geo-throttling indexes
- **trendController.js**: Key endpoints (getHomeTrends, exploreTrends, getPersonalized, getGeoPersonalizedFeed, getHeatmap, recordInteraction, getGraph, getPrediction)
- **authMiddleware.js**: Firebase token verification
- **rateLimiter.js**: Redis-backed distributed rate limiting (apiLimiter, authLimiter, heavyLimiter)

### 8.2.3 AI Analytics & Intelligent Processing Services
- **aiService.js**: Gemini 2.5 Flash integration, in-memory analysis cache (30min TTL), graceful fallback handling, validation pipeline, AI chat with Hinglish persona, rate limit detection
- **aiAnalyticsService.js**: OpenRouter LLM pipeline with DeepSeek → GPT-4o-mini fallback → deterministic local fallback; Zod schema validation; prompt building with scoring context; partial result coercion
- **aiTrendEnhancer.js**: Batch Gemini analysis for trend insights with 1-hour cache; title-based cache key deduplication
- **trendAggregator.js**: Multi-source fetching (NewsAPI, Reddit, GNews, YouTube) with fault tolerance; deduplication engine; ranking algorithm (recency + engagement); Redis caching; DB fallback; cross-platform fusion; clustering pipeline; UI shuffle
- **trendPredictionEngine.js**: Lifecycle state machine (emerging→accelerating→viral→declining→dead); historical confidence calibration from 6-month semantic scan; regional migration matrix with probability-adjusted time lags; explainable justification builder; batch prediction pipeline
- **recommendationEngine.js**: Geo-personalized "For You" feed with 70/20/10 interleaving (local/national/global); affinity vector computation; keyword boost; language weight multiplier; emerging trend boost
- **trendClusteringEngine.js**: Semantic topic clustering (65% overlap threshold, 24h window); geo-anomaly detection firewall (velocity spike, source diversity deficit, geographic impossibility, engagement-to-view ratio, identical velocity curves); quarantine system
- **geoTrendEngine.js**: Hourly regional velocity spike detection (300% threshold); geo-targeted push alerts with daily cap (max 2/user/day); heatmap payload aggregation; emerging trend flagging
- **graphEngine.js**: Trend relationship graph builder using keyword overlap (40% threshold); bidirectional linking; cap enforcement (max 5 related per trend)
- **personalizationService.js**: Interest keyword matching, source preference filtering, recency boost, AI virality boost; scored ranking capped at top 15
- **socketService.js**: WebSocket server with Redis adapter; transactional emissions only (ai:status:completed, alert:push); user-room targeting
- **cacheService.js**: Redis get/setex/del with JSON serialization; category cache busting

## Task 4: Generate PDF
- Write a Node.js script using `pdfkit` to generate `Trend_Pulse_Chapter_8_Coding.pdf`
- Include: cover page, table of contents, all sections with cleaned code blocks
- Use monospace font for code, serif font for body text
- Add page numbers
- Output to `d:\AITrendTracker\Trend_Pulse_Chapter_8_Coding.pdf`
- Run the script to generate the PDF

## Task 5: Verify Output
- Verify the PDF file exists and is readable
- Confirm all code snippets are properly cleaned (no console.log, no raw dumps)
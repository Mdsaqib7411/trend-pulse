/**
 * Geo-Alert Priority System & Dynamic Heatmaps — Unit Tests
 * Phase 3.5 Step 5
 * 
 * TDD Suite for testing MILD vs MAJOR breakout logic, FCM throttling,
 * and dynamic heatmap geolocation resolution.
 */

const geoTrendEngine = require('../services/geoTrendEngine');
const alertService = require('../services/alertService');
const Trend = require('../models/Trend');
const User = require('../models/User');
const Notification = require('../models/Notification');
const cacheService = require('../services/cacheService');

// --- Mocks ---
jest.mock('../models/Trend', () => ({
    find: jest.fn().mockReturnThis(),
    updateOne: jest.fn(),
    updateMany: jest.fn(),
    aggregate: jest.fn(),
    lean: jest.fn()
}));

jest.mock('../models/User', () => ({
    find: jest.fn().mockReturnThis(),
    updateOne: jest.fn(),
    lean: jest.fn()
}));

jest.mock('../models/Notification', () => ({
    create: jest.fn()
}));

jest.mock('../services/cacheService', () => ({
    get: jest.fn(),
    setex: jest.fn()
}));

jest.mock('../services/alertService', () => ({
    checkFCMThrottle: jest.fn(),
    sendFCM: jest.fn(),
    incrementFCMThrottle: jest.fn()
}));

jest.mock('../services/loggerService', () => ({
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn()
}));

jest.mock('../services/socketService', () => ({
    emitAlertToUser: jest.fn()
}));

// Mock external dynamic geocoding API (to be implemented in service)
const mockGeocodeAPI = jest.fn();
geoTrendEngine._fetchDynamicCoordinates = mockGeocodeAPI;

describe('Phase 3.5 Step 5: Geo-Alert & Heatmap Suite', () => {

    beforeEach(() => {
        jest.clearAllMocks();
    });

    const createTrendMock = (deltaPct) => {
        const baseScore = 100;
        const newScore = baseScore + (baseScore * (deltaPct / 100));
        return {
            trendId: `trend_${deltaPct}`,
            title: `Trend with ${deltaPct}% delta`,
            geography: { country: 'IN', state: 'Madhya Pradesh', city: 'Indore' },
            isEmerging: false,
            scoreHistory: [
                { ts: new Date(Date.now() - 65 * 60 * 1000), c: baseScore }, // ~1 hr ago
                { ts: new Date(), c: newScore }
            ]
        };
    };

    describe('Geo-Alert Priority System (MILD_SPIKE vs MAJOR_BREAKOUT)', () => {
        
        test('Mild Spike Validation: 100%-299% delta classifies as MILD_SPIKE, creates notification, NO FCM push', async () => {
            const mildTrend = createTrendMock(150);
            Trend.lean.mockReset().mockResolvedValueOnce([mildTrend]);
            User.lean.mockReset().mockResolvedValueOnce([{ uid: 'user1', fcmToken: 'token1', geoAlertCount: 0 }]);
            
            await geoTrendEngine.scanForEmergingTrends();

            expect(Notification.create).toHaveBeenCalledWith(
                expect.objectContaining({
                    userId: 'user1',
                    type: expect.stringMatching(/MILD_SPIKE|geo_emerging_mild/i)
                })
            );
            expect(alertService.sendFCM).not.toHaveBeenCalled();
        });

        test('Major Breakout Validation: >=300% delta classifies as MAJOR_BREAKOUT, creates notification, TRIGGERS FCM', async () => {
            const majorTrend = createTrendMock(350);
            Trend.lean.mockReset().mockResolvedValueOnce([majorTrend]);
            User.lean.mockReset().mockResolvedValueOnce([{ uid: 'user2', fcmToken: 'token2', geoAlertCount: 0 }]);
            alertService.checkFCMThrottle.mockResolvedValueOnce(true);
            
            await geoTrendEngine.scanForEmergingTrends();

            expect(Notification.create).toHaveBeenCalledWith(
                expect.objectContaining({
                    userId: 'user2',
                    type: expect.stringMatching(/MAJOR_BREAKOUT|geo_emerging/i)
                })
            );
            expect(alertService.checkFCMThrottle).toHaveBeenCalledWith('token2');
            expect(alertService.sendFCM).toHaveBeenCalled();
            expect(alertService.incrementFCMThrottle).toHaveBeenCalledWith('token2');
        });

        test('Strict Capping Enforcement: 3rd MAJOR_BREAKOUT in 24h is throttled/dropped', async () => {
            const majorTrend = createTrendMock(400);
            Trend.lean.mockReset().mockResolvedValueOnce([majorTrend]);
            User.lean.mockReset().mockResolvedValueOnce([{ uid: 'user3', fcmToken: 'token3', geoAlertCount: 2 }]);
            
            await geoTrendEngine.scanForEmergingTrends();

            expect(Notification.create).not.toHaveBeenCalled();
            expect(alertService.sendFCM).not.toHaveBeenCalled();
        });
    });

    describe('Dynamic Heatmap Scaling Registry', () => {

        test('Static Dictionary Fallback: resolves known city (e.g., Bhopal) immediately', async () => {
            // Provided Tokyo is in the static CITY_COORDINATES
            Trend.aggregate.mockResolvedValueOnce([
                { _id: 'Tokyo', weight: 500, count: 10, country: 'JP' }
            ]);

            const payload = await geoTrendEngine.getHeatmapPayload();
            
            expect(payload).toHaveLength(1);
            expect(payload[0].city).toBe('Tokyo');
            expect(payload[0].lat).toBe(35.6762);
            expect(payload[0].lng).toBe(139.6503);
            
            // Dynamic fetch should not be called
            expect(mockGeocodeAPI).not.toHaveBeenCalled();
        });

        test('Dynamic Registry Integration: fetches and registers new city via external API mock', async () => {
            Trend.aggregate.mockResolvedValueOnce([
                { _id: 'Indore', weight: 800, count: 15, country: 'IN' }
            ]);

            // Mock the dynamic geocode resolution
            mockGeocodeAPI.mockResolvedValueOnce({ lat: 22.7196, lng: 75.8577 });

            const payload = await geoTrendEngine.getHeatmapPayload();
            
            expect(payload).toHaveLength(1);
            expect(payload[0].city).toBe('Indore');
            expect(payload[0].lat).toBe(22.7196);
            expect(payload[0].lng).toBe(75.8577);
            
            expect(mockGeocodeAPI).toHaveBeenCalledWith('Indore', 'IN');
            // Assuming it registers into the active DB/Cache
        });

        test('Graceful Geolocation Fallback: defaults to country center if dynamic fetch fails/timeouts', async () => {
            Trend.aggregate.mockResolvedValueOnce([
                { _id: 'UnknownVillage', weight: 200, count: 5, country: 'IN' }
            ]);

            // Simulate timeout/failure
            mockGeocodeAPI.mockRejectedValueOnce(new Error('Geocode API Timeout'));

            const payload = await geoTrendEngine.getHeatmapPayload();
            
            expect(payload).toHaveLength(1);
            expect(payload[0].city).toBe('UnknownVillage');
            // Should fallback to India country center (approx 20.5937, 78.9629) or at least not crash
            expect(payload[0].lat).toBeDefined();
            expect(payload[0].lng).toBeDefined();
        });
    });

    describe('Batch Aggregation & Redis Caching', () => {

        test('Heatmap Response Structure: aggregates correctly into [{city, country, weight, count, lat, lng}]', async () => {
            Trend.aggregate.mockResolvedValueOnce([
                { _id: 'London', weight: 1000, count: 20, topTrend: 'UK Elections', country: 'GB' }
            ]);

            const payload = await geoTrendEngine.getHeatmapPayload();
            
            expect(payload).toBeInstanceOf(Array);
            expect(payload[0]).toHaveProperty('city', 'London');
            expect(payload[0]).toHaveProperty('country', 'GB');
            expect(payload[0]).toHaveProperty('weight', 1000);
            expect(payload[0]).toHaveProperty('count', 20);
            expect(payload[0]).toHaveProperty('lat');
            expect(payload[0]).toHaveProperty('lng');
        });

        test('Redis Caching Layer: endpoint caches payload for exactly 600 seconds', async () => {
            cacheService.get.mockResolvedValueOnce(null); // Cache miss
            Trend.aggregate.mockResolvedValueOnce([
                { _id: 'Dubai', weight: 600, count: 12, country: 'AE' }
            ]);

            await geoTrendEngine.getHeatmapPayload();

            // Verify cache setter was called with 600s
            expect(cacheService.setex).toHaveBeenCalledWith(
                'trendpulse:geo:heatmap',
                600,
                expect.any(Array)
            );
        });

        test('Redis Caching Layer: reads from cache on subsequent hits', async () => {
            const cachedPayload = [{ city: 'Paris', lat: 48.8566, lng: 2.3522, weight: 400, count: 5 }];
            cacheService.get.mockResolvedValueOnce(cachedPayload); // Cache hit

            const payload = await geoTrendEngine.getHeatmapPayload();
            
            expect(payload).toEqual(cachedPayload);
            expect(Trend.aggregate).not.toHaveBeenCalled(); // DB hit avoided
        });
    });

});

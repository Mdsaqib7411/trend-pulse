/**
 * Feed Cache Service — Unit Tests
 * Phase 3.5 Step 4: Namespaced Advanced Feed Cache Layer & Adaptive Diversity.
 */

// Mock ioredis before requiring the service
const mockRedisGet = jest.fn();
const mockRedisSetex = jest.fn();
const mockRedisDel = jest.fn();
const mockRedisIncr = jest.fn();
const mockRedisExpire = jest.fn();
const mockRedisScanStream = jest.fn();

jest.mock('ioredis', () => {
    return jest.fn().mockImplementation(() => {
        return {
            status: 'ready',
            on: jest.fn(),
            get: mockRedisGet,
            setex: mockRedisSetex,
            del: mockRedisDel,
            incr: mockRedisIncr,
            expire: mockRedisExpire,
            scanStream: mockRedisScanStream
        };
    });
});

jest.mock('../services/loggerService', () => ({
    error: jest.fn(),
    info: jest.fn(),
    warn: jest.fn()
}));

const feedCacheService = require('../services/feedCacheService');

describe('FeedCacheService', () => {
    
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('generateCacheKey', () => {
        test('generates correct multi-tenant key schema', () => {
            const key = feedCacheService.generateCacheKey('US', 'California', 'local', 'en');
            expect(key).toBe('feed:us:california:local:en');
        });

        test('handles missing or undefined parameters with defaults', () => {
            const key = feedCacheService.generateCacheKey(undefined, null, undefined);
            expect(key).toBe('feed:global:all:auto:en');
        });

        test('normalizes spaces and casing', () => {
            const key = feedCacheService.generateCacheKey('United Kingdom', 'Greater London', 'National', 'EN-GB');
            expect(key).toBe('feed:united_kingdom:greater_london:national:en-gb');
        });
    });

    describe('getCachedFeed', () => {
        test('returns parsed JSON data on cache hit', async () => {
            const mockData = [{ trendId: 't1' }, { trendId: 't2' }];
            mockRedisGet.mockResolvedValueOnce(JSON.stringify(mockData));

            const result = await feedCacheService.getCachedFeed('test-key');
            expect(result).toEqual(mockData);
            expect(mockRedisGet).toHaveBeenCalledWith('test-key');
        });

        test('returns null on cache miss', async () => {
            mockRedisGet.mockResolvedValueOnce(null);

            const result = await feedCacheService.getCachedFeed('test-key');
            expect(result).toBeNull();
        });

        test('returns null on parsing error or exception', async () => {
            mockRedisGet.mockRejectedValueOnce(new Error('Redis Down'));

            const result = await feedCacheService.getCachedFeed('test-key');
            expect(result).toBeNull();
        });
    });

    describe('setCachedFeed', () => {
        test('sets cache with exact 600s TTL', async () => {
            const mockData = [{ trendId: 't1' }];
            await feedCacheService.setCachedFeed('test-key', mockData);

            expect(mockRedisSetex).toHaveBeenCalledWith('test-key', 600, JSON.stringify(mockData));
        });
    });

    describe('invalidateRegionCache', () => {
        test('safely sets up stream matching region pattern', async () => {
            const mockStream = {
                on: jest.fn((event, callback) => {
                    if (event === 'data') {
                        callback(['feed:us:texas:local:en', 'feed:us:texas:national:en']);
                    }
                })
            };
            mockRedisScanStream.mockReturnValueOnce(mockStream);
            mockRedisDel.mockResolvedValueOnce(2);

            await feedCacheService.invalidateRegionCache('US', 'Texas');

            expect(mockRedisScanStream).toHaveBeenCalledWith({ match: 'feed:us:texas:*', count: 100 });
            expect(mockRedisDel).toHaveBeenCalledWith('feed:us:texas:local:en', 'feed:us:texas:national:en');
        });

        test('handles wildcards correctly when state is not provided', async () => {
            const mockStream = { on: jest.fn() };
            mockRedisScanStream.mockReturnValueOnce(mockStream);

            await feedCacheService.invalidateRegionCache('IN');
            expect(mockRedisScanStream).toHaveBeenCalledWith({ match: 'feed:in:*:*', count: 100 });
        });
    });

    describe('Adaptive Diversity Matrix Overrides', () => {
        
        test('getDiversityMatrixOverride returns parsed override if exists', async () => {
            const mockOverride = { localRatio: 0.85, nationalRatio: 0.10, globalRatio: 0.05 };
            mockRedisGet.mockResolvedValueOnce(JSON.stringify(mockOverride));

            const result = await feedCacheService.getDiversityMatrixOverride('user123');
            expect(result).toEqual(mockOverride);
            expect(mockRedisGet).toHaveBeenCalledWith('user:diversity:user123');
        });

        test('getDiversityMatrixOverride returns null if no override exists', async () => {
            mockRedisGet.mockResolvedValueOnce(null);
            const result = await feedCacheService.getDiversityMatrixOverride('user123');
            expect(result).toBeNull();
        });

        test('trackUserInteraction increments global skip counter and expires in 1h', async () => {
            mockRedisIncr.mockResolvedValueOnce(1); // 1st skip
            
            await feedCacheService.trackUserInteraction('user123', 'skip', 'global');
            
            expect(mockRedisIncr).toHaveBeenCalledWith('user:skips:global:user123');
            expect(mockRedisExpire).toHaveBeenCalledWith('user:skips:global:user123', 3600);
            expect(mockRedisSetex).not.toHaveBeenCalled(); // override not triggered yet
        });

        test('trackUserInteraction triggers override and resets counter after 5 consecutive skips', async () => {
            mockRedisIncr.mockResolvedValueOnce(5); // 5th skip
            mockRedisDel.mockResolvedValueOnce(1);
            
            await feedCacheService.trackUserInteraction('user123', 'skip', 'global');
            
            // Should set adaptive override
            expect(mockRedisSetex).toHaveBeenCalledWith(
                'user:diversity:user123',
                24 * 60 * 60, // 24 hours
                expect.stringContaining('"localRatio":0.85')
            );
            // Should reset the counter
            expect(mockRedisDel).toHaveBeenCalledWith('user:skips:global:user123');
        });

        test('trackUserInteraction does not trigger override on non-global skips', async () => {
            await feedCacheService.trackUserInteraction('user123', 'skip', 'local');
            expect(mockRedisIncr).not.toHaveBeenCalled();
        });

        test('trackUserInteraction resets skip counter on positive engagement', async () => {
            await feedCacheService.trackUserInteraction('user123', 'click', 'global');
            expect(mockRedisDel).toHaveBeenCalledWith('user:skips:global:user123');

            await feedCacheService.trackUserInteraction('user123', 'like', 'local');
            expect(mockRedisDel).toHaveBeenCalledWith('user:skips:global:user123');
        });
    });
});

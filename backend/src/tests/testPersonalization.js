/**
 * Personalization Engine — Unit Tests
 * 
 * Run: node backend/src/tests/testPersonalization.js
 */

const PersonalizationService = require('../services/personalizationService');
const service = new PersonalizationService.constructor();

// ─── Mock Data ───
const mockTrends = [
    {
        title: 'GPT-5 Release Date Announced by OpenAI',
        trendScore: 110,
        source: 'YouTube',
        publishedAt: new Date(Date.now() - 1 * 60 * 60 * 1000), // 1 hour ago
        analysis: { viralityScore: 9 },
        type: 'video'
    },
    {
        title: 'NVIDIA Stock Surges After AI Chip Launch',
        trendScore: 95,
        source: 'r/technology',
        publishedAt: new Date(Date.now() - 5 * 60 * 60 * 1000), // 5 hours ago
        analysis: { viralityScore: 6 },
        type: 'reddit'
    },
    {
        title: 'Tesla Robotics Division Expands Operations',
        trendScore: 80,
        source: 'NewsAPI',
        publishedAt: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2 hours ago
        analysis: { viralityScore: 4 },
        type: 'news'
    },
    {
        title: 'Healthcare AI Detects Cancer Earlier Than Doctors',
        trendScore: 100,
        source: 'GNews',
        publishedAt: new Date(Date.now() - 10 * 60 * 60 * 1000), // 10 hours ago
        analysis: { viralityScore: 7 },
        type: 'news'
    },
    {
        title: 'Blockchain Meets AI in New DeFi Protocol',
        trendScore: 70,
        source: 'r/CryptoCurrency',
        publishedAt: new Date(Date.now() - 8 * 60 * 60 * 1000),
        analysis: null,
        type: 'reddit'
    }
];

let passed = 0;
let failed = 0;

function assert(condition, testName) {
    if (condition) {
        console.log(`  ✅ PASS: ${testName}`);
        passed++;
    } else {
        console.log(`  ❌ FAIL: ${testName}`);
        failed++;
    }
}

// ─── TEST 1: User WITH interests → boosted results ───
console.log('\n📋 TEST 1: User with interests gets boosted results');
const user1 = {
    interests: ['gpt', 'nvidia', 'healthcare'],
    preferredSources: []
};
const result1 = service.personalizeTrends(mockTrends, user1);
assert(result1.length > 0, 'Returns non-empty array');
assert(result1[0].personalizedScore > result1[0].trendScore, 'Top trend has boosted score');
assert(result1[0].matchedInterests.length > 0, 'Top trend has matched interests');
assert(result1[0].reason.includes('Matched'), 'Reason includes match info');

// ─── TEST 2: User WITHOUT interests → normal trends ───
console.log('\n📋 TEST 2: User without interests gets normal trends');
const user2 = {
    interests: [],
    preferredSources: []
};
const result2 = service.personalizeTrends(mockTrends, user2);
assert(result2.length > 0, 'Returns non-empty array');
assert(!result2[0].reason.includes('Matched'), 'No interest match in reason');
assert(result2[0].matchedInterests.length === 0, 'No matched interests');
assert(result2[0].personalizedScore >= result2[0].trendScore, 
       'Score is base or boosted by recency/virality only');

// ─── TEST 3: Preferred source FILTER works ───
console.log('\n📋 TEST 3: Preferred source filter');
const user3 = {
    interests: [],
    preferredSources: ['YouTube']
};
const result3 = service.personalizeTrends(mockTrends, user3);
assert(result3.length > 0, 'Returns results');
assert(result3.every(t => t.source.toLowerCase().includes('youtube')), 
       'All results are from preferred source only');

// ─── TEST 4: Sorting by personalizedScore works ───
console.log('\n📋 TEST 4: Sorted by personalizedScore DESC');
const user4 = {
    interests: ['gpt', 'nvidia', 'healthcare', 'tesla'],
    preferredSources: []
};
const result4 = service.personalizeTrends(mockTrends, user4);
let isSorted = true;
for (let i = 1; i < result4.length; i++) {
    if (result4[i].personalizedScore > result4[i - 1].personalizedScore) {
        isSorted = false;
        break;
    }
}
assert(isSorted, 'Results are sorted by personalizedScore DESC');

// ─── TEST 5: Empty trends array handled safely ───
console.log('\n📋 TEST 5: Empty trends array');
const result5 = service.personalizeTrends([], user1);
assert(Array.isArray(result5), 'Returns array');
assert(result5.length === 0, 'Returns empty array');

// ─── TEST 6: Null/undefined handled safely ───
console.log('\n📋 TEST 6: Null trends handled');
const result6 = service.personalizeTrends(null, user1);
assert(Array.isArray(result6), 'Returns array for null input');
assert(result6.length === 0, 'Returns empty for null');

// ─── TEST 7: Interest boost cap at 60 ───
console.log('\n📋 TEST 7: Interest boost capped at 60');
const user7 = {
    interests: ['gpt', 'openai', 'release', 'date', 'announced'], // 5 matches possible
    preferredSources: []
};
const result7 = service.personalizeTrends(mockTrends, user7);
const gptTrend = result7.find(t => t.title.toLowerCase().includes('gpt'));
if (gptTrend) {
    // Base=110 + interestBoost(capped 60) + recency(10) + virality(15) = max 195
    assert(gptTrend.personalizedScore <= 195, `Interest boost capped correctly (score: ${gptTrend.personalizedScore})`);
} else {
    assert(false, 'GPT trend not found');
}

// ─── SUMMARY ───
console.log(`\n${'═'.repeat(40)}`);
console.log(`  Results: ${passed} passed, ${failed} failed`);
console.log(`${'═'.repeat(40)}\n`);

process.exit(failed > 0 ? 1 : 0);

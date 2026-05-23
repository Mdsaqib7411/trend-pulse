const mongoose = require('mongoose');

const trendHistorySchema = new mongoose.Schema({
    trendId: { 
        type: String, 
        required: true, 
        index: true 
    },
    title: { 
        type: String, 
        required: true 
    },
    source: { 
        type: String 
    },
    trendScore: { 
        type: Number, 
        default: 0 
    },
    engagementScore: { 
        type: Number, 
        default: 0 
    },
    viralityScore: { 
        type: Number, 
        default: 0 
    },
    mentionsCount: { 
        type: Number, 
        default: 0 
    },
    timestamp: { 
        type: Date, 
        default: Date.now,
        index: true 
    }
}, { timestamps: true });

// Compound index for efficient time-series querying per trend
trendHistorySchema.index({ trendId: 1, timestamp: -1 });

module.exports = mongoose.model('TrendHistory', trendHistorySchema);

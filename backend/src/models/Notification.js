const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
    userId: { 
        type: String, 
        required: true, 
        index: true 
    },
    title: { 
        type: String, 
        required: true 
    },
    message: { 
        type: String, 
        required: true 
    },
    trendId: { 
        type: String, 
        default: null 
    },
    type: {
        type: String,
        enum: ['hot_trend', 'multi_source', 'viral_spike', 'system', 'rising', 'breaking', 'community', 'video'],
        default: 'hot_trend'
    },
    read: { 
        type: Boolean, 
        default: false 
    }
}, { timestamps: true });

// Compound index: fast lookup for user's unread notifications
notificationSchema.index({ userId: 1, read: 1, createdAt: -1 });

// Prevent duplicate alerts for the same trend to the same user
notificationSchema.index({ userId: 1, trendId: 1 }, { unique: true, sparse: true });

module.exports = mongoose.model('Notification', notificationSchema);

const admin = require('firebase-admin');
const path = require('path');

// Initialize Firebase Admin
try {
    // Relative to backend/src/utils/firebaseAdmin.js
    // ../ -> src
    // ../ -> backend
    const serviceAccount = require('../../aitrendtracker-74f73-firebase-adminsdk-fbsvc-abc9174106.json');
    
    // Check if apps already initialized to prevent 'app/duplicate-app' errors during hot reloads
    if (!admin.apps.length) {
        admin.initializeApp({
            credential: admin.credential.cert(serviceAccount)
        });
        console.log('Firebase Admin initialized successfully.');
    }
} catch (error) {
    console.error('Firebase Admin initialization error:', error.message);
}

module.exports = admin;

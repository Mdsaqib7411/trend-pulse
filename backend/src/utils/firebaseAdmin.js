const admin = require('firebase-admin');

// Initialize Firebase Admin
try {
    // Check if apps already initialized to prevent 'app/duplicate-app' errors during hot reloads
    if (!admin.apps.length) {
        let serviceAccount;

        if (process.env.FIREBASE_PROJECT_ID && process.env.FIREBASE_PRIVATE_KEY && process.env.FIREBASE_CLIENT_EMAIL) {
            serviceAccount = {
                projectId: process.env.FIREBASE_PROJECT_ID,
                clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
                privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
            };
        } else {
            try {
                serviceAccount = require('../../aitrendtracker-74f73-firebase-adminsdk-fbsvc-ce4cdbe96d.json');
            } catch (e) {
                try {
                    serviceAccount = require('../../../aitrendtracker-74f73-firebase-adminsdk-fbsvc-ce4cdbe96d.json');
                } catch (e2) {
                    serviceAccount = require('../../aitrendtracker-74f73-firebase-adminsdk-fbsvc-abc9174106.json');
                }
            }
        }

        if (serviceAccount) {
            admin.initializeApp({
                credential: admin.credential.cert(serviceAccount)
            });
            console.log('Firebase Admin initialized successfully.');
        }
    }
} catch (error) {
    console.error('Firebase Admin initialization error:', error.message);
}

module.exports = admin;

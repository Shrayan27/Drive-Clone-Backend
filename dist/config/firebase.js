"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.auth = exports.bucket = void 0;
const firebase_admin_1 = __importDefault(require("firebase-admin"));
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
let bucket = null;
exports.bucket = bucket;
let auth = null;
exports.auth = auth;
let firebaseAdmin = null;
const hasFirebaseConfig = process.env.FIREBASE_PROJECT_ID &&
    process.env.FIREBASE_PRIVATE_KEY &&
    process.env.FIREBASE_CLIENT_EMAIL;
if (hasFirebaseConfig) {
    try {
        const serviceAccount = {
            type: "service_account",
            project_id: process.env.FIREBASE_PROJECT_ID,
            private_key_id: process.env.FIREBASE_PRIVATE_KEY_ID,
            private_key: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
            client_email: process.env.FIREBASE_CLIENT_EMAIL,
            client_id: process.env.FIREBASE_CLIENT_ID,
            auth_uri: process.env.FIREBASE_AUTH_URI,
            token_uri: process.env.FIREBASE_TOKEN_URI,
            auth_provider_x509_cert_url: process.env.FIREBASE_AUTH_PROVIDER_X509_CERT_URL,
            client_x509_cert_url: process.env.FIREBASE_CLIENT_X509_CERT_URL,
        };
        if (!firebase_admin_1.default.apps.length) {
            firebase_admin_1.default.initializeApp({
                credential: firebase_admin_1.default.credential.cert(serviceAccount),
                storageBucket: `${process.env.FIREBASE_PROJECT_ID}.appspot.com`,
            });
            console.log("Firebase Admin SDK initialized successfully");
        }
        exports.bucket = bucket = firebase_admin_1.default.storage().bucket();
        exports.auth = auth = firebase_admin_1.default.auth();
        firebaseAdmin = firebase_admin_1.default;
    }
    catch (error) {
        console.error("Error initializing Firebase Admin SDK:", error);
    }
}
else {
    console.log("Firebase environment variables not configured. Using mock services for development.");
    exports.bucket = bucket = {
        file: (path) => ({
            save: async (data) => console.log('Mock file save:', path),
            getSignedUrl: async () => ({ data: { signedUrl: 'mock-url' } })
        })
    };
    exports.auth = auth = {
        verifyIdToken: async (token) => ({ uid: 'mock-uid', email: 'mock@example.com' })
    };
}
exports.default = firebaseAdmin;
//# sourceMappingURL=firebase.js.map
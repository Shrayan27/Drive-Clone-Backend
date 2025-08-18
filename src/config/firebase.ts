import admin from "firebase-admin";
import dotenv from "dotenv";

dotenv.config();

// For now, create a mock bucket to prevent errors
let bucket: any = null;
let auth: any = null;
let firebaseAdmin: any = null;

// Check if Firebase environment variables are configured
const hasFirebaseConfig =
  process.env.FIREBASE_PROJECT_ID &&
  process.env.FIREBASE_PRIVATE_KEY &&
  process.env.FIREBASE_CLIENT_EMAIL;

if (hasFirebaseConfig) {
  try {
    // Initialize Firebase Admin SDK
    const serviceAccount = {
      type: "service_account",
      project_id: process.env.FIREBASE_PROJECT_ID,
      private_key_id: process.env.FIREBASE_PRIVATE_KEY_ID,
      private_key: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
      client_email: process.env.FIREBASE_CLIENT_EMAIL,
      client_id: process.env.FIREBASE_CLIENT_ID,
      auth_uri: process.env.FIREBASE_AUTH_URI,
      token_uri: process.env.FIREBASE_TOKEN_URI,
      auth_provider_x509_cert_url:
        process.env.FIREBASE_AUTH_PROVIDER_X509_CERT_URL,
      client_x509_cert_url: process.env.FIREBASE_CLIENT_X509_CERT_URL,
    };

    // Initialize Firebase Admin
    if (!admin.apps.length) {
      admin.initializeApp({
        credential: admin.credential.cert(
          serviceAccount as admin.ServiceAccount
        ),
        storageBucket: `${process.env.FIREBASE_PROJECT_ID}.appspot.com`,
      });
      console.log("Firebase Admin SDK initialized successfully");
    }

    // Get Firebase services
    bucket = admin.storage().bucket();
    auth = admin.auth();
    firebaseAdmin = admin;
  } catch (error) {
    console.error("Error initializing Firebase Admin SDK:", error);
  }
} else {
  console.log(
    "Firebase environment variables not configured. Using mock services for development."
  );
  
  // Create mock services for development
  bucket = {
    file: (path: string) => ({
      save: async (data: any) => console.log('Mock file save:', path),
      getSignedUrl: async () => ({ data: { signedUrl: 'mock-url' } })
    })
  };
  
  auth = {
    verifyIdToken: async (token: string) => ({ uid: 'mock-uid', email: 'mock@example.com' })
  };
}

// Export services
export { bucket, auth };
export default firebaseAdmin;

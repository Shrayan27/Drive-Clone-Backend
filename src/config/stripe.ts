import Stripe from "stripe";

// Initialize Stripe only if the secret key is available
let stripe: Stripe | null = null;

if (
  process.env.STRIPE_SECRET_KEY &&
  process.env.STRIPE_SECRET_KEY.trim() !== ""
) {
  try {
    stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
      apiVersion: "2025-07-30.basil",
    });
    console.log("Stripe initialized successfully");
  } catch (error) {
    console.error("Failed to initialize Stripe:", error);
  }
} else {
  console.log("STRIPE_SECRET_KEY not set - Stripe features will be disabled");
}

export { stripe };

export const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET || null;

export const PREMIUM_PLANS = {
  basic: {
    name: "Basic Plan",
    price: 999, // $9.99 in cents
    storage: 100 * 1024 * 1024 * 1024, // 100 GB in bytes
    features: [
      "100 GB Storage",
      "Basic Support",
      "File Sharing",
      "Version History",
    ],
  },
  pro: {
    name: "Pro Plan",
    price: 1999, // $19.99 in cents
    storage: 1024 * 1024 * 1024 * 1024, // 1 TB in bytes
    features: [
      "1 TB Storage",
      "Priority Support",
      "Advanced Sharing",
      "Full Version History",
      "Real-time Collaboration",
    ],
  },
  enterprise: {
    name: "Enterprise Plan",
    price: 4999, // $49.99 in cents
    storage: 5 * 1024 * 1024 * 1024 * 1024, // 5 TB in bytes
    features: [
      "5 TB Storage",
      "24/7 Support",
      "Advanced Security",
      "Team Management",
      "Real-time Collaboration",
      "Custom Integrations",
    ],
  },
};

"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PREMIUM_PLANS = exports.STRIPE_WEBHOOK_SECRET = exports.stripe = void 0;
const stripe_1 = __importDefault(require("stripe"));
let stripe = null;
exports.stripe = stripe;
if (process.env.STRIPE_SECRET_KEY &&
    process.env.STRIPE_SECRET_KEY.trim() !== "") {
    try {
        exports.stripe = stripe = new stripe_1.default(process.env.STRIPE_SECRET_KEY, {
            apiVersion: "2025-07-30.basil",
        });
        console.log("Stripe initialized successfully");
    }
    catch (error) {
        console.error("Failed to initialize Stripe:", error);
    }
}
else {
    console.log("STRIPE_SECRET_KEY not set - Stripe features will be disabled");
}
exports.STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET || null;
exports.PREMIUM_PLANS = {
    basic: {
        name: "Basic Plan",
        price: 999,
        storage: 100 * 1024 * 1024 * 1024,
        features: [
            "100 GB Storage",
            "Basic Support",
            "File Sharing",
            "Version History",
        ],
    },
    pro: {
        name: "Pro Plan",
        price: 1999,
        storage: 1024 * 1024 * 1024 * 1024,
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
        price: 4999,
        storage: 5 * 1024 * 1024 * 1024 * 1024,
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
//# sourceMappingURL=stripe.js.map
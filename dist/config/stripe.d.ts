import Stripe from "stripe";
declare let stripe: Stripe | null;
export { stripe };
export declare const STRIPE_WEBHOOK_SECRET: string | null;
export declare const PREMIUM_PLANS: {
    basic: {
        name: string;
        price: number;
        storage: number;
        features: string[];
    };
    pro: {
        name: string;
        price: number;
        storage: number;
        features: string[];
    };
    enterprise: {
        name: string;
        price: number;
        storage: number;
        features: string[];
    };
};
//# sourceMappingURL=stripe.d.ts.map
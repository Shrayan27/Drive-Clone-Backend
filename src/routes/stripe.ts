import express from "express";
import { authenticateToken as auth } from "../middleware/auth";
import {
  createCheckoutSession,
  handleWebhook,
  getSubscriptionStatus,
  cancelSubscription,
  reactivateSubscription,
} from "../controllers/stripeController";

const router = express.Router();

// Create checkout session (protected route)
router.post("/create-checkout-session", auth, createCheckoutSession);

// Get subscription status (protected route)
router.get("/subscription/:userId", auth, getSubscriptionStatus);

// Cancel subscription (protected route)
router.post("/subscription/:userId/cancel", auth, cancelSubscription);

// Reactivate subscription (protected route)
router.post("/subscription/:userId/reactivate", auth, reactivateSubscription);

// Stripe webhook (unprotected - needs raw body)
router.post(
  "/webhook",
  express.raw({ type: "application/json" }),
  handleWebhook
);

export default router;

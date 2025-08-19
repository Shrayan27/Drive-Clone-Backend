import { Request, Response } from "express";
import { stripe, PREMIUM_PLANS } from "../config/stripe";
import pool from "../database/connection";

export const createCheckoutSession = async (req: Request, res: Response) => {
  try {
    // Check if Stripe is initialized
    if (!stripe) {
      return res
        .status(503)
        .json({ error: "Stripe payment service is not available" });
    }

    const { priceId, planId, userId } = req.body;

    if (!priceId || !planId || !userId) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    const plan = PREMIUM_PLANS[planId as keyof typeof PREMIUM_PLANS];
    if (!plan) {
      return res.status(400).json({ error: "Invalid plan" });
    }

    // Create Stripe checkout session
    try {
      const session = await stripe.checkout.sessions.create({
        payment_method_types: ["card"],
        line_items: [
          {
            price_data: {
              currency: "usd",
              product_data: {
                name: plan.name,
                description: `${
                  plan.storage / (1024 * 1024 * 1024)
                } GB Storage Plan`,
              },
              unit_amount: plan.price,
            },
            quantity: 1,
          },
        ],
        mode: "subscription",
        success_url: `${process.env.CLIENT_URL}/dashboard?success=true&session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${process.env.CLIENT_URL}/dashboard?canceled=true`,
        metadata: {
          userId,
          planId,
        },
      });

      return res.json({ sessionId: session.id });
    } catch (stripeError) {
      console.error("Stripe API error:", stripeError);
      return res.status(500).json({ error: "Stripe service error" });
    }
  } catch (error) {
    console.error("Stripe checkout error:", error);
    return res.status(500).json({
      error:
        error instanceof Error ? error.message : String(error),
    });
  }
};

export const handleWebhook = async (req: Request, res: Response) => {
  if (!stripe) {
    return res.status(503).json({ error: "Stripe payment service is not available" });
  }
  const sig = req.headers["stripe-signature"];
  if (!sig) {
    return res.status(400).json({ error: "Missing signature" });
  }
  try {
    if (!process.env.STRIPE_WEBHOOK_SECRET) {
      return res.status(500).json({ error: "Webhook secret not configured" });
    }
    const event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
    switch (event.type) {
      case "checkout.session.completed":
        await handleCheckoutCompleted(event.data.object as any);
        break;
      case "customer.subscription.updated":
        await handleSubscriptionUpdated(event.data.object as any);
        break;
      case "customer.subscription.deleted":
        await handleSubscriptionDeleted(event.data.object as any);
        break;
      default:
        console.log(`Unhandled event type: ${event.type}`);
    }
    return res.json({ received: true });
  } catch (error) {
    console.error("Webhook error:", error);
    return res.status(400).json({ error: "Webhook signature verification failed" });
  }
};

const handleCheckoutCompleted = async (session: any) => {
  try {
    const { userId, planId } = session.metadata;
    const plan = PREMIUM_PLANS[planId as keyof typeof PREMIUM_PLANS];

    if (!plan) {
      console.error("Invalid plan ID:", planId);
      return;
    }

    // Update user subscription in database
    try {
      const result = await pool.query(
        `UPDATE users
         SET subscription_plan = $1,
             storage_limit = $2,
             subscription_status = $3,
             stripe_customer_id = $4,
             stripe_subscription_id = $5,
             updated_at = $6
         WHERE id = $7`,
        [
          planId,
          plan.storage,
          "active",
          session.customer,
          session.subscription,
          new Date(),
          userId,
        ]
      );

      console.log(
        `User ${userId} subscribed to ${planId} plan with storage limit ${plan.storage} bytes`
      );
    } catch (error) {
      console.error("Failed to update user subscription:", error);
    }
  } catch (error) {
    console.error("Error handling checkout completed:", error);
  }
};

const handleSubscriptionUpdated = async (subscription: any) => {
  try {
    console.log(
      `Subscription ${subscription.id} status updated to ${subscription.status}`
    );

    // Update subscription status in database
    try {
      const result = await pool.query(
        `UPDATE users SET subscription_status = $1, updated_at = $2 WHERE stripe_subscription_id = $3`,
        [subscription.status, new Date(), subscription.id]
      );

      if (result.rowCount === 0) {
        console.warn(`No user found with subscription ID: ${subscription.id}`);
      }
    } catch (error) {
      console.error("Failed to update subscription status:", error);
    }
  } catch (error) {
    console.error("Error handling subscription updated:", error);
  }
};

const handleSubscriptionDeleted = async (subscription: any) => {
  try {
    console.log(
      `Subscription ${subscription.id} deleted, user reverted to free plan`
    );

    // Revert user to free plan in database
    try {
      const result = await pool.query(
        `UPDATE users 
         SET subscription_plan = $1, 
             storage_limit = $2, 
             subscription_status = $3, 
             updated_at = $4 
         WHERE stripe_subscription_id = $5`,
        [
          "free",
          5 * 1024 * 1024 * 1024,
          "canceled",
          new Date(),
          subscription.id,
        ]
      );

      if (result.rowCount === 0) {
        console.warn(`No user found with subscription ID: ${subscription.id}`);
      }
    } catch (error) {
      console.error("Failed to revert user to free plan:", error);
    }
  } catch (error) {
    console.error("Error handling subscription deleted:", error);
  }
};

export const getSubscriptionStatus = async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    if (!userId) {
      return res.status(400).json({ error: "User ID is required" });
    }
    const result = await pool.query(
      `SELECT subscription_plan, subscription_status, storage_limit, stripe_subscription_id FROM users WHERE id = $1`,
      [userId]
    );
    if (result.rowCount === 0) {
      return res.status(404).json({ error: "User not found" });
    }
    const user = result.rows[0];
    const subscription = {
      plan: user.subscription_plan || "free",
      status: user.subscription_status || "inactive",
      storageLimit: user.storage_limit || 5 * 1024 * 1024 * 1024,
      subscriptionId: user.stripe_subscription_id,
    };
    return res.json(subscription);
  } catch (error) {
    console.error("Error fetching subscription status:", error);
    return res.status(500).json({ error: "Failed to fetch subscription status" });
  }
};

export const cancelSubscription = async (req: Request, res: Response) => {
  try {
    if (!stripe) {
      return res
        .status(503)
        .json({ error: "Stripe payment service is not available" });
    }

    const { userId } = req.params;
    const { subscriptionId } = req.body;

    if (!userId || !subscriptionId) {
      return res
        .status(400)
        .json({ error: "User ID and subscription ID are required" });
    }

    // Cancel the subscription in Stripe
    try {
      await stripe.subscriptions.update(subscriptionId, {
        cancel_at_period_end: true,
      });

      // Update the database to reflect the cancellation
      await pool.query(
        `UPDATE users 
         SET subscription_status = $1, 
             updated_at = $2 
         WHERE id = $3 AND stripe_subscription_id = $4`,
        ["canceled", new Date(), userId, subscriptionId]
      );

      res.json({
        message:
          "Subscription will be canceled at the end of the current period",
      });
    } catch (stripeError) {
      console.error("Stripe cancellation error:", stripeError);
      res.status(500).json({ error: "Failed to cancel subscription" });
    }
  } catch (error) {
    console.error("Error canceling subscription:", error);
    res.status(500).json({ error: "Failed to cancel subscription" });
  }
};

export const reactivateSubscription = async (req: Request, res: Response) => {
  try {
    if (!stripe) {
      return res
        .status(503)
        .json({ error: "Stripe payment service is not available" });
    }

    const { userId } = req.params;
    const { subscriptionId } = req.body;

    if (!userId || !subscriptionId) {
      return res
        .status(400)
        .json({ error: "User ID and subscription ID are required" });
    }

    // Reactivate the subscription in Stripe
    try {
      await stripe.subscriptions.update(subscriptionId, {
        cancel_at_period_end: false,
      });

      // Update the database to reflect the reactivation
      await pool.query(
        `UPDATE users 
         SET subscription_status = $1, 
             updated_at = $2 
         WHERE id = $3 AND stripe_subscription_id = $4`,
        ["active", new Date(), userId, subscriptionId]
      );

      res.json({ message: "Subscription reactivated successfully" });
    } catch (stripeError) {
      console.error("Stripe reactivation error:", stripeError);
      res.status(500).json({ error: "Failed to reactivate subscription" });
    }
  } catch (error) {
    console.error("Error reactivating subscription:", error);
    res.status(500).json({ error: "Failed to reactivate subscription" });
  }
};

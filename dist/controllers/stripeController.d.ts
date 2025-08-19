import { Request, Response } from "express";
export declare const createCheckoutSession: (req: Request, res: Response) => Promise<Response<any, Record<string, any>>>;
export declare const handleWebhook: (req: Request, res: Response) => Promise<Response<any, Record<string, any>> | undefined>;
export declare const getSubscriptionStatus: (req: Request, res: Response) => Promise<Response<any, Record<string, any>> | undefined>;
export declare const cancelSubscription: (req: Request, res: Response) => Promise<Response<any, Record<string, any>> | undefined>;
export declare const reactivateSubscription: (req: Request, res: Response) => Promise<Response<any, Record<string, any>> | undefined>;
//# sourceMappingURL=stripeController.d.ts.map
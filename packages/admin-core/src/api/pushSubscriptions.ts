import { request } from "../client";

export interface AdminPushSubscriptionInput {
  endpoint: string;
  keys: { p256dh: string; auth: string };
}

export const subscribeToPush = (subscription: AdminPushSubscriptionInput) =>
  request("/api/me/push-subscriptions", {
    method: "POST",
    body: JSON.stringify(subscription),
  });

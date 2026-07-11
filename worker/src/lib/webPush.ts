import { buildPushHTTPRequest } from "@pushforge/builder";

export type PushSubscriptionInput = {
  endpoint: string;
  keys: { p256dh: string; auth: string };
};

export type SendPushResult =
  { ok: true } | { ok: false; expired: boolean; status: number };

export const sendWebPush = async (
  subscription: PushSubscriptionInput,
  payload: { title: string; body: string },
  vapid: { privateJWK: string; subject: string },
): Promise<SendPushResult> => {
  const { endpoint, headers, body } = await buildPushHTTPRequest({
    privateJWK: JSON.parse(vapid.privateJWK),
    subscription,
    message: {
      payload,
      adminContact: vapid.subject,
      options: { ttl: 3600, urgency: "high" },
    },
  });

  const res = await fetch(endpoint, { method: "POST", headers, body });

  if (res.ok) return { ok: true };
  return {
    ok: false,
    expired: res.status === 404 || res.status === 410,
    status: res.status,
  };
};

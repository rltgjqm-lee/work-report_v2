export type SafetyAlert = {
  alertId: string;
  message: string;
  region: string | null;
  alertType: string | null;
  source: "MOIS" | "MANUAL";
  sentAt: string;
  targetCount: number;
  successCount: number;
  failCount: number;
};

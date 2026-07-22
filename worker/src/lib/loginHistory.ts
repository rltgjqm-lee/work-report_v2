import { drizzle } from "drizzle-orm/d1";

import { adminLoginHistory } from "../db/schema";

type DB = ReturnType<typeof drizzle>;

export const recordLoginHistory = async (
  db: DB,
  fields: {
    adminId: number | null;
    email: string;
    success: boolean;
    ipAddress: string | null;
  },
): Promise<void> => {
  await db.insert(adminLoginHistory).values(fields);
};

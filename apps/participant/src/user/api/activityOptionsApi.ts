import { queryOptions } from "@tanstack/react-query";

export type ActivityOptionCategory = "CONTENT" | "PLACE";

export type ActivityOption = {
  id: number;
  category: ActivityOptionCategory;
  label: string;
};

const BASE_URL = import.meta.env.VITE_API_BASE_URL;

const activityOptionKeys = {
  all: ["public-activity-options"] as const,
  byProgram: (programId: number) => [...activityOptionKeys.all, programId] as const,
};

const getActivityOptions = async (programId: number): Promise<ActivityOption[]> => {
  const response = await fetch(`${BASE_URL}/public/programs/${programId}/activity-options`);

  if (!response.ok) throw new Error("업무 항목 목록을 불러오지 못했습니다.");

  return response.json();
};

export const activityOptionsQueryOptions = (programId: number | undefined) =>
  queryOptions({
    queryKey: activityOptionKeys.byProgram(programId ?? 0),
    queryFn: () => getActivityOptions(programId as number),
    enabled: !!programId,
  });

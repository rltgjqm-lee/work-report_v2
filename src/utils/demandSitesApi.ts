import { queryOptions } from "@tanstack/react-query";

export type DemandSite = {
  id: number;
  name: string;
};

const BASE_URL = import.meta.env.VITE_API_BASE_URL;

export const demandSiteKeys = {
  all: ["public-demand-sites"] as const,
  byProgram: (programId: number) => [...demandSiteKeys.all, programId] as const,
};

export const getDemandSites = async (programId: number): Promise<DemandSite[]> => {
  const response = await fetch(`${BASE_URL}/public/programs/${programId}/demand-sites`);

  if (!response.ok) throw new Error("수요처 목록을 불러오지 못했습니다.");

  return response.json();
};

export const demandSitesQueryOptions = (programId: number) =>
  queryOptions({
    queryKey: demandSiteKeys.byProgram(programId),
    queryFn: () => getDemandSites(programId),
  });

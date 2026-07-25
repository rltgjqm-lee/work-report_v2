export type Organization = {
  id: number;
  name: string;
  regionSido: string | null;
  regionSigungu: string | null;
  organizationType: string | null;
};

export type Program = {
  id: number;
  name: string;
  organizationId: number;
  startDate: string;
  endDate: string;
  startTime: string;
  endTime: string;
  programType: string | null;
};

export type Affiliations = {
  organizations: Organization[];
  programs: Program[];
};

export type DemandSite = {
  id: number;
  name: string;
};

const BASE_URL = import.meta.env.VITE_API_BASE_URL;

export const getAffiliations = async (): Promise<Affiliations> => {
  const response = await fetch(`${BASE_URL}/public/affiliations`);

  if (!response.ok) throw new Error("기관/사업단 목록을 불러오지 못했습니다.");

  return response.json();
};

export const getDemandSites = async (
  programId: number,
): Promise<DemandSite[]> => {
  const response = await fetch(
    `${BASE_URL}/public/programs/${programId}/demand-sites`,
  );

  if (!response.ok) throw new Error("수요처 목록을 불러오지 못했습니다.");

  return response.json();
};

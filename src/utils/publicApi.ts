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

const BASE_URL = import.meta.env.VITE_API_BASE_URL;

export const getAffiliations = async (): Promise<Affiliations> => {
  const response = await fetch(`${BASE_URL}/public/affiliations`);

  if (!response.ok) throw new Error("기관/사업단 목록을 불러오지 못했습니다.");

  return response.json();
};

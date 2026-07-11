export type PublicOrganization = { id: number; name: string };

export type PublicProgram = {
  id: number;
  name: string;
  organizationId: number;
  startDate: string;
  endDate: string;
  startTime: string;
  endTime: string;
};

const BASE_URL = import.meta.env.VITE_API_BASE_URL;

export const listPublicOrganizations = async (): Promise<
  PublicOrganization[]
> => {
  const res = await fetch(`${BASE_URL}/public/organizations`);
  if (!res.ok) throw new Error("기관 목록을 불러오지 못했습니다.");
  return res.json();
};

export const listPublicPrograms = async (
  organizationId: number,
): Promise<PublicProgram[]> => {
  const res = await fetch(
    `${BASE_URL}/public/programs?organizationId=${organizationId}`,
  );
  if (!res.ok) throw new Error("사업단 목록을 불러오지 못했습니다.");
  return res.json();
};

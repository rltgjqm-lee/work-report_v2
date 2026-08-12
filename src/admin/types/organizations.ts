export type Organization = {
  id: number;
  name: string;
  address: string | null;
  rep: string | null;
  phone: string | null;
  fax: string | null;
  bizNo: string | null;
  regionSido: string | null;
  regionSigungu: string | null;
  organizationType: string | null;
  prjYear: string | null;
  isActive: boolean;
  createdAt: string;
};

// 기관 유형 코드 — 화면엔 label을 보여주고 저장은 value(코드)로 한다.
// 새 유형이 늘어나면 여기에 추가한다.
export const ORGANIZATION_TYPES = [{ value: "SENIOR_CLUB", label: "시니어클럽" }] as const;

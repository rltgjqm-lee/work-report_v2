import type { ActivityLogFormData } from "./form";

// 💡 직접 선언해 주어야 하는 규칙 타입!
export interface ValidationRule {
  field: keyof ActivityLogFormData;
  message: string;
}

// 💡 Page 1: 초기 설정 검증 규칙 상수
export const PAGE1_RULES: ValidationRule[] = [
  { field: "orgName", message: "(1) 기관명을 넣어주세요" },
  { field: "projectName", message: "(2) 참여사업명을 넣어주세요" },
  { field: "userName", message: "(3) 참여자성명을 넣어주세요" },
  { field: "demandName", message: "(4) 수요처명을 넣어주세요" },
];

// 💡 Page 3: 활동 일시 검증 규칙 상수
export const PAGE3_RULES: ValidationRule[] = [
  { field: "actDate", message: "활동일자를 입력해 주세요." },
];

// 💡 Page 4: 활동 내용 및 장소 검증 규칙 상수
export const PAGE4_RULES: ValidationRule[] = [
  { field: "actContent", message: "활동 내용을 입력해 주세요." },
  { field: "actPlace", message: "활동 장소를 입력해 주세요." },
];

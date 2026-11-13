export const PROGRAM_TYPES = [
  { value: "공익 활동", label: "공익 활동" },
  { value: "역량 활용", label: "역량 활용" },
];

export const PROGRAM_TYPE_FILTER_OPTIONS = [
  { value: "all", label: "전체 유형" },
  ...PROGRAM_TYPES,
];

export const PROGRAM_TYPE_SELECT_OPTIONS = [
  { value: "", label: "선택하세요" },
  ...PROGRAM_TYPES,
];

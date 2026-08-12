export const LOCAL_STORAGE_KEYS = {
  FORM_DRAFT: "form_draft", // 기본 정보 입력 폼 임시 저장 (formData 전체 필드)
} as const;

/**
 * 💡 IndexedDB 관련 이름 및 버전 상수
 */
export const INDEXED_DB_CONFIG = {
  DB_NAME: "SeniorActivityDB",
  DB_VERSION: 1,
  STORE_NAME: "activity_logs",
} as const;

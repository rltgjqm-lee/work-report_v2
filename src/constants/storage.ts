export const LOCAL_STORAGE_KEYS = {
  CONF_ORG: "conf_org", // 기관명
  CONF_PROJ: "conf_proj", // 참여사업명
  CONF_DEMAND: "conf_demand", // 수요처명
  CONF_USER: "conf_user", // 참여자 성명
  USER_SIGN: "userSign", // 참여자 서명 (Base64)
  DEMAND_SIGN: "demandSign", // 확인자 서명 (Base64)
} as const;

/**
 * 💡 IndexedDB 관련 이름 및 버전 상수
 */
export const INDEXED_DB_CONFIG = {
  DB_NAME: "SeniorActivityDB",
  DB_VERSION: 1,
  STORE_NAME: "activity_logs",
} as const;

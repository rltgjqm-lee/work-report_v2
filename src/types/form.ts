export interface ActivityLogFormData {
  // Page 1: 초기 설정
  id?: number;
  participantId?: number; // 이름+전화번호로 식별된 실제 participants 행 id (서버 동기화용)
  orgName: string;
  programName: string;
  demandName: string;
  gender: "남성" | "여성" | "";
  userName: string;
  // Page 3: 활동 일시
  actDate: string;
  startTime: {
    ampm: "AM" | "PM";
    hour: string;
    minute: string;
  };
  endTime: {
    ampm: "AM" | "PM";
    hour: string;
    minute: string;
  };
  actTotalTime: string;

  // Page 4: 활동 내용 및 장소
  actContent: string;
  actPlace: string;

  // Page 5: 안전사고 유무
  hasAccident: boolean;
  accidentDetail: string;
  accidentAction: "귀가" | "업무수행";

  // Page 6: 서명 및 동의
  userSignature: string; // canvas에서 추출할 base64 이미지 스트링 등
  demandSignature: string; // canvas에서 추출할 base64 이미지 스트링 등
  saveSignatureConsent: boolean;
}

export interface ActivityLogItem {
  id?: number;
  participantId?: number;
  synced?: boolean; // 서버 동기화 완료 여부 (오프라인 저장 큐)
  serverId?: number; // 동기화된 서버측 activity_logs.id
  date: string; // YYYY-MM-DD
  start: string; // HH:MM
  end: string; // HH:MM
  totalTime: string;
  content: string;
  place: string;
  accident: "유" | "무";
  accidentDetail?: string;
  accidentAction?: string;
  uSign: string;
  dSign: string;
  timestamp: number; // 정렬용 타임스탬프
}

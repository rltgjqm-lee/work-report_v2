export interface ActivityLogFormData {
  // Page 1: 초기 설정
  orgName: string;
  projectName: string;
  demandName: string;
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

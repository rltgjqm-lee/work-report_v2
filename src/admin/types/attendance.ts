type AttendanceStatus = "NORMAL" | "LATE" | "EARLY_LEAVE" | "INVALID";

export type AttendanceLog = {
  id: number;
  participantId: number;
  groupId: number | null;
  programId: number;
  workDate: string;
  clockIn: string | null;
  clockOut: string | null;
  totalMinutes: number | null;
  status: AttendanceStatus;
  note: string | null;
  signatureKey: string | null;
  createdAt: string;
  // 출퇴근 버튼을 누른 시점의 위치. 위치 권한을 거부했거나 GPS를 못 잡으면 전부 null이다.
  // inside는 "구역 밖(false)"과 "판정 불가(null: 좌표·수요처·관제구역 없음)"가 다르다.
  // 관제 반경이 최소 1.5km라 inside만으론 자택 출근을 못 걸러내므로 distanceM을 같이 본다.
  clockInLat: number | null;
  clockInLng: number | null;
  clockInAccuracy: number | null;
  clockInInside: boolean | null;
  clockInDistanceM: number | null;
  clockOutLat: number | null;
  clockOutLng: number | null;
  clockOutAccuracy: number | null;
  clockOutInside: boolean | null;
  clockOutDistanceM: number | null;
  // 이 날 받은 좌표 중 위치 조작 앱이 주입한 것으로 표시된 건수(출퇴근 + 근무 중 보고).
  // 하이브리드 앱에서만 채워지고 웹 사용자는 항상 0이므로, 0을 결백으로 읽으면 안 된다.
  simulatedCount: number;
};

// 같은 참여자+근무일의 활동일지(업무/안전/서명) 완료 여부. 그날 활동일지 자체가 없으면
// (참여자가 아직 아무것도 저장 안 함) 전부 기본값(false)으로 내려온다.
export type ActivityLogSummary = {
  hasAccident: boolean;
  accidentChecked: boolean;
  accidentDetail: string | null;
  accidentAction: string | null;
  signed: boolean;
};

export type ParticipantAttendanceRow = {
  log: AttendanceLog;
  groupName: string | null;
  shiftStart: string | null;
  shiftEnd: string | null;
  activity: ActivityLogSummary;
  // 위치 열 옆에 보여주는, 그날 처리된 안전관제 이탈 상태/메모
  escapeStatus: "OPEN" | "RESOLVED" | null;
  escapeMemo: string | null;
};

export type AttendanceStats = {
  total: number;
  normal: number;
  late: number;
  earlyLeave: number;
  totalHours: number;
};

export type ParticipantMonthlyAttendance = {
  logs: ParticipantAttendanceRow[];
  stats: AttendanceStats;
};

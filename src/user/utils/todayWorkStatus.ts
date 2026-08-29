import type { ActivityLogFormData } from "../../types/form";

export interface TodayStatus {
  isWorkDay: boolean;
  shiftStart: string | null;
  shiftEnd: string | null;
}

export type TodayWorkCardStatus =
  | { kind: "noUserName" }
  | { kind: "noParticipantId" }
  | {
      kind: "active";
      dateLabel: string;
      statusLabel: string;
      isWorkDay: boolean;
      isWorking: boolean;
      programName: string;
      shiftLabel: string;
      nextLogStep: string;
      completedLogSteps: number;
      totalLogSteps: number;
      isLogComplete: boolean;
    };

const WEEKDAY_LABEL = ["일", "월", "화", "수", "목", "금", "토"];

export const getTodayDateLabel = () => {
  const now = new Date();
  return `${now.getMonth() + 1}월 ${now.getDate()}일 ${WEEKDAY_LABEL[now.getDay()]}요일`;
};

// HomePage(일반)와 HomePageLargeFont(큰글씨)가 같은 근무 상태 판단 로직을 그대로
// 공유하도록 뽑아둔 순수 함수 — 화면마다 이 로직이 따로 갈라지면 두 화면의 "근무중" 판정
// 기준이 슬쩍 어긋나는 버그가 생기기 쉽다.
export const computeTodayWorkCardStatus = (
  formData: ActivityLogFormData,
  todayStatus: TodayStatus | null,
): TodayWorkCardStatus => {
  if (!formData.userName) return { kind: "noUserName" };
  if (!formData.participantId) return { kind: "noParticipantId" };

  const attendanceInDone = formData.startTime.hour !== "";
  const attendanceOutDone = formData.endTime.hour !== "";
  const isWorking = attendanceInDone && !attendanceOutDone;
  // participantId는 있지만 서버 응답 전(로딩 중)엔 근무일로 가정한다.
  const isWorkDay = todayStatus?.isWorkDay ?? true;

  // 출근 전(둘 다 아직 안 함)과 퇴근 완료(둘 다 끝남)를 구분해야 하는데, isWorking은
  // "근무중"만 가려낼 뿐이라 이 둘을 구분 못 한다 — attendanceOutDone을 따로 확인한다.
  let statusLabel = "출근 전";
  if (!isWorkDay) {
    statusLabel = "휴무";
  } else if (isWorking) {
    statusLabel = "근무중";
  } else if (attendanceOutDone) {
    statusLabel = "퇴근 완료";
  }

  // 오늘 일지 진행 상황 — ActivityDashboardPage와 같은 순서(출근→업무일지→안전일지→퇴근→서명).
  // 역량 활용은 업무·안전 일지가 없어서 건너뛴다.
  const isCompetencyProgram = formData.programType === "역량 활용";
  const workDone = !!formData.actContent && !!formData.actPlace;
  const safetyDone = formData.accidentChecked;
  const signatureDone = !!formData.userSignature;

  let nextLogStep = "완료";
  if (!attendanceInDone) {
    nextLogStep = "출근 대기";
  } else if (!isCompetencyProgram && !workDone) {
    nextLogStep = "업무일지 대기";
  } else if (!isCompetencyProgram && !safetyDone) {
    nextLogStep = "안전일지 대기";
  } else if (!attendanceOutDone) {
    nextLogStep = "퇴근 대기";
  } else if (!signatureDone) {
    nextLogStep = "서명 대기";
  }

  const totalLogSteps = isCompetencyProgram ? 3 : 5;
  const completedLogSteps =
    (attendanceInDone ? 1 : 0) +
    (isCompetencyProgram ? 0 : (workDone ? 1 : 0) + (safetyDone ? 1 : 0)) +
    (attendanceOutDone ? 1 : 0) +
    (signatureDone ? 1 : 0);
  const isLogComplete = nextLogStep === "완료";

  let shiftLabel = "-";
  if (todayStatus?.shiftStart && todayStatus?.shiftEnd) {
    shiftLabel = `${todayStatus.shiftStart}~${todayStatus.shiftEnd}`;
  }

  return {
    kind: "active",
    dateLabel: getTodayDateLabel(),
    statusLabel,
    isWorkDay,
    isWorking,
    programName: formData.programName,
    shiftLabel,
    nextLogStep,
    completedLogSteps,
    totalLogSteps,
    isLogComplete,
  };
};

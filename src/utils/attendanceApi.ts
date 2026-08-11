import { Capacitor, CapacitorHttp } from "@capacitor/core";
import { mutationOptions, queryOptions } from "@tanstack/react-query";

import { readCurrentCoordinates } from "./geolocation";
import type { Coordinates } from "./geolocation";

const BASE_URL = import.meta.env.VITE_API_BASE_URL;

// credentials: "include" — 이 브라우저에 관리자 콘솔 로그인 세션 쿠키가 있으면 같이
// 실려가서, 서버가 출퇴근 테스트용 날짜/시간 override를 통합관리자에게만 허용하는 데 쓴다.
// 일반 참여자는 그 쿠키가 없으니 그냥 무시될 뿐 평소 동작엔 영향이 없다.
const request = async <T>(path: string, body: object): Promise<T> => {
  const res = await fetch(`${BASE_URL}${path}`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}) as { error?: string });
    throw new Error(data.error || "요청에 실패했습니다.");
  }
  return res.json();
};

// 참여자 앱에서 "테스트용 날짜/시간" 패널을 실서버에서도 통합관리자에게만 보여주기
// 위한 체크 — 관리자 세션 쿠키가 없거나 만료됐으면 조용히 null을 돌려준다.
const getCurrentAdminRole = async (): Promise<string | null> => {
  try {
    const res = await fetch(`${BASE_URL}/api/me`, { credentials: "include" });
    if (!res.ok) return null;
    const data = (await res.json()) as { role?: string };
    return data.role ?? null;
  } catch {
    return null;
  }
};

const adminRoleKeys = {
  all: ["admin-role"] as const,
};

export const adminRoleQueryOptions = queryOptions({
  queryKey: adminRoleKeys.all,
  queryFn: getCurrentAdminRole,
});

export type TodayAttendance = {
  clockIn: string | null;
  clockOut: string | null;
  // 오늘이 배정된 근무일인지 — 참여자/조 스케줄이 아예 없는 사업단은 제약이 없다는 뜻으로 true.
  isWorkDay: boolean;
  shiftStart: string | null; // "HH:MM", 조가 없으면 null
  shiftEnd: string | null;
};

// 오늘 실제 출퇴근 기록(서버 attendance_logs)을 조회 — 홈 화면의 출근/퇴근 상태는
// 브라우저 로컬 캐시가 아니라 이 값을 기준으로 맞춘다(캐시가 없거나 어긋나도 정확하도록).
// debug가 있으면 clock-in/out과 같은 날짜 기준으로 조회한다(테스트 패널 날짜와 어긋나지 않도록).
export const getTodayAttendance = async (
  participantId: number,
  debug?: DebugAttendanceOverride,
): Promise<TodayAttendance> => {
  const params = new URLSearchParams({ participantId: String(participantId) });
  if (debug?.date) params.set("debugDate", debug.date);
  if (debug?.time) params.set("debugTime", debug.time);

  const res = await fetch(`${BASE_URL}/public/attendance/today?${params.toString()}`);
  if (!res.ok) {
    const data = await res.json().catch(() => ({}) as { error?: string });
    throw new Error(data.error || "출퇴근 기록 조회에 실패했습니다.");
  }
  return res.json();
};

// 💡 등록확인 화면이 참여자 상태/사업 기간을 바로 판단할 수 있도록 서버가 한 응답에
// 다 실어보낸다 — registrationStatus/affiliations를 별도로 왕복하지 않아도 되게 하기 위함
export type IdentifiedParticipant = {
  participantId: number;
  name: string;
  status: "ACTIVE" | "ON_LEAVE" | "DROPPED";
  leaveEnd: string | null;
  program: { startDate: string; endDate: string } | null;
  organization: { regionSido: string | null; regionSigungu: string | null } | null;
};

// 💡 메시지 문구는 화면(RegistrationConfirmPage)에서 조립한다 — 여기서는 백엔드가 내려준
// 코드/데이터를 그대로 실어 던지기만 한다.
export type IdentifyErrorBody =
  | { error: "MISSING_FIELDS" | "PROGRAM_NOT_FOUND" }
  | {
      error: "NOT_REGISTERED";
      organization: {
        regionSido: string | null;
        regionSigungu: string | null;
        name: string;
      } | null;
      program: { name: string; programType: string | null };
    };

export class IdentifyError extends Error {
  body: IdentifyErrorBody;

  constructor(body: IdentifyErrorBody) {
    super(body.error);
    this.body = body;
  }
}

const identifyParticipant = async (
  programId: number,
  name: string,
): Promise<IdentifiedParticipant> => {
  const res = await fetch(`${BASE_URL}/public/attendance/identify`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ programId, name }),
  });
  if (!res.ok) {
    const data = await res
      .json()
      .catch(() => ({ error: "PROGRAM_NOT_FOUND" }) as IdentifyErrorBody);
    throw new IdentifyError(data);
  }
  return res.json();
};

const identifyParticipantKeys = {
  all: ["identify-participant"] as const,
  byProgramAndName: (programId: number, name: string) =>
    [...identifyParticipantKeys.all, programId, name] as const,
};

// 💡 등록확인 화면이 identifyParticipantQueryOptions의 select에서 실제로 받는 모양
export type IdentifiedRegistration = {
  participantId: number;
  status: IdentifiedParticipant["status"];
  leaveEnd: string | null;
  program: IdentifiedParticipant["program"];
  orgAddress: string;
};

export const identifyParticipantQueryOptions = (
  programId: number | undefined,
  name: string | undefined,
) =>
  queryOptions({
    queryKey: identifyParticipantKeys.byProgramAndName(programId ?? 0, name ?? ""),
    queryFn: () => identifyParticipant(programId as number, name as string),
    enabled: !!programId && !!name,
    select: (identified: IdentifiedParticipant): IdentifiedRegistration => ({
      participantId: identified.participantId,
      status: identified.status,
      leaveEnd: identified.leaveEnd,
      program: identified.program,
      orgAddress: [identified.organization?.regionSido, identified.organization?.regionSigungu]
        .filter(Boolean)
        .join(" "),
    }),
  });

// debug.date("YYYY-MM-DD")/debug.time("HH:MM")은 출퇴근 날짜·시간 검증을 테스트하기
// 위한 override — 서버가 localhost 요청이거나 통합관리자 세션일 때만 실제로 반영한다.
export type DebugAttendanceOverride = { date?: string; time?: string };

// coordinates는 있으면 같이 보내고 없으면 생략한다 — 서버도 위치 없이 들어온 출퇴근을
// 그대로 받아주므로(기록용), 위치를 못 읽었다고 출퇴근을 포기하면 안 된다.
const coordinatesPayload = (coordinates?: Coordinates | null) =>
  coordinates
    ? {
        lat: coordinates.lat,
        lng: coordinates.lng,
        ...(coordinates.accuracy !== null && {
          accuracy: coordinates.accuracy,
        }),
        ...(coordinates.simulated !== null && {
          simulated: coordinates.simulated,
        }),
      }
    : {};

// 💡 "너무 이르다" 실패는 안내 모달에 시간표까지 같이 보여줘야 해서(HomePage의
// AttendanceTimeGuideModal), 문구가 아니라 코드/데이터 그대로 받아서 컴포넌트로 전달한다.
export type ClockInErrorBody =
  | { error: "TOO_EARLY"; now: string; shiftStart: string; shiftEnd: string }
  | { error: "NOT_WORK_DAY" }
  | { error: string };

export class ClockInError extends Error {
  body: ClockInErrorBody;

  constructor(body: ClockInErrorBody) {
    super(body.error);
    this.body = body;
  }
}

const clockIn = async (
  participantId: number,
  debug?: DebugAttendanceOverride,
  coordinates?: Coordinates | null,
): Promise<{ id: number; clockIn: string }> => {
  const res = await fetch(`${BASE_URL}/public/attendance/clock-in`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      participantId,
      ...coordinatesPayload(coordinates),
      ...(debug?.date && { debugDate: debug.date }),
      ...(debug?.time && { debugTime: debug.time }),
    }),
  });
  if (!res.ok) {
    const data = await res
      .json()
      .catch(() => ({ error: "출근 등록에 실패했습니다." }) as ClockInErrorBody);
    throw new ClockInError(data);
  }
  return res.json();
};

// 💡 "너무 이르다" 실패는 안내 모달에서 시간 부분만 강조해야 해서, 문구가 아니라
// 코드/데이터 그대로 받아서 컴포넌트로 전달한다(ClockInError와 동일한 패턴).
export type ClockOutErrorBody = { error: "TOO_EARLY_OUT"; shiftEnd: string } | { error: string };

export class ClockOutError extends Error {
  body: ClockOutErrorBody;

  constructor(body: ClockOutErrorBody) {
    super(body.error);
    this.body = body;
  }
}

const clockOut = async (
  participantId: number,
  debug?: DebugAttendanceOverride,
  coordinates?: Coordinates | null,
): Promise<{ id: number; clockOut: string; totalMinutes: number }> => {
  const res = await fetch(`${BASE_URL}/public/attendance/clock-out`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      participantId,
      ...coordinatesPayload(coordinates),
      ...(debug?.date && { debugDate: debug.date }),
      ...(debug?.time && { debugTime: debug.time }),
    }),
  });
  if (!res.ok) {
    const data = await res
      .json()
      .catch(() => ({ error: "퇴근 등록에 실패했습니다." }) as ClockOutErrorBody);
    throw new ClockOutError(data);
  }
  return res.json();
};

export interface ClockInVariables {
  participantId: number;
  debug?: DebugAttendanceOverride;
}

// 💡 위치 측위(최대 10초)까지 mutationFn 안에 넣어서, useMutation의 isPending이 측위부터
// 서버 등록까지 전체 구간을 커버하게 한다 — 화면은 그동안 버튼만 잠그면 된다.
export const clockInMutationOptions = mutationOptions({
  mutationFn: async ({ participantId, debug }: ClockInVariables) => {
    const coordinates = await readCurrentCoordinates();
    return clockIn(participantId, debug, coordinates);
  },
});

export interface ClockOutVariables {
  participantId: number;
  debug?: DebugAttendanceOverride;
}

export const clockOutMutationOptions = mutationOptions({
  mutationFn: async ({ participantId, debug }: ClockOutVariables) => {
    const coordinates = await readCurrentCoordinates();
    return clockOut(participantId, debug, coordinates);
  },
});

// 근무 중 위치 보고의 응답. escaped=true면 관제구역을 벗어난 상태이고,
// uncertain=true면 GPS 오차가 커서 서버가 이탈 판정을 보류한 것이다(둘은 배타적).
export type LocationReportResult = {
  ok: boolean;
  escaped: boolean;
  uncertain?: boolean;
  distanceKm?: number;
  accuracyM?: number;
  alertCount?: number;
  demandSiteName?: string;
  message?: string;
};

// 안드로이드는 앱이 백그라운드로 간 뒤 5분이 지나면 WebView에서 나가는 HTTP 요청을
// 스로틀링한다 — 근무 중 위치 보고가 바로 그 시점부터 조용히 실패하므로, 네이티브 앱에서는
// 네이티브 HTTP로 우회한다. 서명 업로드(Blob)까지 통째로 갈아끼우면 위험해서 fetch를
// 전역 패치(CapacitorHttp.enabled)하지 않고 이 요청 하나만 네이티브로 보낸다.
// https://github.com/capacitor-community/background-geolocation/issues/14
const postViaNativeHttp = async <T>(path: string, body: object): Promise<T> => {
  const response = await CapacitorHttp.post({
    url: `${BASE_URL}${path}`,
    headers: { "Content-Type": "application/json" },
    data: body,
  });
  if (response.status < 200 || response.status >= 300) {
    const data = response.data as { error?: string } | null;
    throw new Error(data?.error || "요청에 실패했습니다.");
  }
  return response.data as T;
};

// 근무 중 위치 보고 — 서버가 관제구역 이탈을 판정하고 통신 끊김 감지용 수신 시각도 갱신한다.
// 출근 중이 아니면 서버가 escaped=false와 함께 조용히 무시한다.
export const reportLocation = (participantId: number, coordinates: Coordinates) => {
  const body = { participantId, ...coordinatesPayload(coordinates) };
  return Capacitor.isNativePlatform()
    ? postViaNativeHttp<LocationReportResult>("/public/location", body)
    : request<LocationReportResult>("/public/location", body);
};

// signatureDataUrl은 캔버스가 만든 base64 data URL이지만, 여기서 바로 바이너리로
// 되돌려서 서버에는 base64를 거치지 않고 진짜 PNG 바이트로 전송한다.
export const signAttendance = async (
  participantId: number,
  signatureDataUrl: string,
): Promise<{ id: number; signatureKey: string }> => {
  const blob = await (await fetch(signatureDataUrl)).blob();
  const res = await fetch(`${BASE_URL}/public/attendance/sign?participantId=${participantId}`, {
    method: "POST",
    headers: { "Content-Type": blob.type || "image/png" },
    body: blob,
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}) as { error?: string });
    throw new Error(data.error || "요청에 실패했습니다.");
  }
  return res.json();
};

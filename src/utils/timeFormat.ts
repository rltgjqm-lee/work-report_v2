import type { ActivityLogFormData } from "../types/form";

type TimeParts = ActivityLogFormData["startTime"];

// "AM 09:00" 같은 폼 표기를 "09:00" 24시간제 문자열로 변환. 아직 출근/퇴근 전이라
// hour가 비어있으면(모듈 미완료) 빈 문자열을 돌려준다 — "NaN:" 같은 값이 저장되는 걸 방지.
export const formatTimeField = (time: TimeParts): string => {
  if (!time.hour) return "";
  let hour24 = parseInt(time.hour, 10);
  if (time.ampm === "PM" && hour24 !== 12) hour24 += 12;
  if (time.ampm === "AM" && hour24 === 12) hour24 = 0;
  return `${String(hour24).padStart(2, "0")}:${time.minute}`;
};

// 서버가 돌려주는 ISO 시각("...T09:05:00.000Z", KST 벽시계 시각을 UTC로 표기만 한 값)을
// 폼의 {ampm,hour,minute} 구조로 되돌린다 — 출근/퇴근 자동기록 직후 폼에 반영할 때 씀.
export const isoToTimeParts = (iso: string): TimeParts =>
  hhmmToTimeParts(`${iso.slice(11, 13)}:${iso.slice(14, 16)}`);

// "09:05" 같은 24시간제 문자열(IndexedDB의 ActivityLogItem.start/end)을 폼의
// {ampm,hour,minute} 구조로 되돌린다 — 홈 진입 시 오늘 레코드를 다시 불러올 때 씀.
export const hhmmToTimeParts = (time: string): TimeParts => {
  const hour24 = Number(time.slice(0, 2));
  const minute = time.slice(3, 5);
  const ampm = hour24 >= 12 ? "PM" : "AM";
  let hour12 = hour24 % 12;
  if (hour12 === 0) hour12 = 12;
  return { ampm, hour: String(hour12).padStart(2, "0"), minute };
};

import html2pdf from "html2pdf.js";

type CapacityAttendanceMarker = "HOLIDAY" | "WEEKEND" | "PRESENT" | "ABSENT" | "NONE";

interface CapacityAttendanceDay {
  day: number;
  date: string;
  marker: CapacityAttendanceMarker;
  label?: string;
  startTime?: string | null;
  endTime?: string | null;
  totalMinutes?: number | null;
  // 활동일지에 받은 참여자 서명(data URL)
  signatureDataUrl?: string | null;
}

export interface CapacityAttendanceParticipant {
  name: string;
  groupName: string;
  shiftStart: string | null;
  shiftEnd: string | null;
  days: CapacityAttendanceDay[];
}

export const DEFAULT_CAPACITY_ATTENDANCE_BANNER_TEXT =
  "안전수칙을 지켜서 즐겁고 안전한 일자리를 우리가 만들어요!\n" +
  "안전한 복장 착용하기 ⇒ 안전하게 이동하기 ⇒ 간단한 스트레칭하기\n" +
  "※ 주변 잘 살피고 장애물은 내가 먼저 치우기";

// 반쪽당 5열(날짜 · 근무시작시간 · 근무종료시간 · 결근 · 참여자서명)의 너비 비율 —
// 예전 엑셀 서식의 열 너비(10, 11, 11, 7, 11)를 그대로 옮겼다.
const HALF_COLUMN_WIDTHS = [10, 11, 11, 7, 11];
const COL_COUNT_PER_HALF = HALF_COLUMN_WIDTHS.length;
const DAYS_PER_COLUMN = 16;

const escapeHtml = (text: string) =>
  text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const withLineBreaks = (text: string) => escapeHtml(text).replace(/\n/g, "<br>");

const PAGE_STYLE = `
  .attendance-page { width: 718px; padding: 0; box-sizing: border-box; font-family: 'Malgun Gothic', '맑은 고딕', 'Apple SD Gothic Neo', sans-serif; color: #000; background: #fff; }
  .attendance-page + .attendance-page { page-break-before: always; }
  .attendance-page h1 { text-align: center; font-size: 21px; font-weight: bold; margin: 0 0 10px; }
  .attendance-page table { width: 100%; border-collapse: collapse; table-layout: fixed; }
  .attendance-page td { border: 1px solid #000; text-align: center; vertical-align: middle; font-size: 11px; padding: 2px 3px; word-break: keep-all; }
  .attendance-page .info td { text-align: left; height: 26px; font-size: 12px; padding: 0 6px; }
  .attendance-page .header td { font-weight: bold; }
  .attendance-page .day td { height: 28px; }
  .attendance-page .weekend { background: #d9d9d9; }
  .attendance-page .holiday { color: #ff0000; font-weight: bold; }
  .attendance-page .absent { color: #c0392b; font-weight: bold; }
  .attendance-page .signature { height: 24px; max-width: 100%; object-fit: contain; vertical-align: middle; }
  .attendance-page .result td { height: 28px; }
  .attendance-page .note td.text { text-align: left; padding: 4px 6px; line-height: 1.5; }
  .attendance-page .guide { font-size: 10px; line-height: 1.6; margin-top: 12px; }
  .attendance-page .banner { color: #c0392b; font-weight: bold; font-size: 15px; text-align: center; line-height: 1.6; margin-top: 10px; }
`;

const renderDayCells = (monthNum: number, day: CapacityAttendanceDay | undefined) => {
  if (!day) return "<td></td>".repeat(COL_COUNT_PER_HALF);

  const dateCell = `${monthNum}월 ${day.day}일`;
  if (day.marker === "WEEKEND") {
    // 공식 서식(2.역량활동_출근부.pdf)은 주말에 별도 텍스트 없이 행 전체를 회색으로 칠한다
    return `<td class="weekend">${dateCell}</td>${'<td class="weekend"></td>'.repeat(COL_COUNT_PER_HALF - 1)}`;
  }
  if (day.marker === "HOLIDAY") {
    return `<td>${dateCell}</td><td></td><td></td><td></td><td class="holiday">${escapeHtml(day.label ?? "공휴일")}</td>`;
  }
  if (day.marker === "PRESENT") {
    const signature = day.signatureDataUrl
      ? `<img class="signature" src="${day.signatureDataUrl}" alt="">`
      : "";
    return `<td>${dateCell}</td><td>${escapeHtml(day.startTime ?? "")}</td><td>${escapeHtml(day.endTime ?? "")}</td><td></td><td>${signature}</td>`;
  }
  if (day.marker === "ABSENT") {
    return `<td>${dateCell}</td><td></td><td></td><td class="absent">결근</td><td></td>`;
  }
  return `<td>${dateCell}</td><td></td><td></td><td></td><td></td>`;
};

const renderParticipantPage = (
  programName: string,
  month: string,
  participant: CapacityAttendanceParticipant,
  bannerText: string,
) => {
  const monthNum = Number(month.slice(5, 7));
  const columnWidthTotal = HALF_COLUMN_WIDTHS.reduce((sum, width) => sum + width, 0) * 2;
  const colgroup = [...HALF_COLUMN_WIDTHS, ...HALF_COLUMN_WIDTHS]
    .map((width) => `<col style="width:${((width / columnWidthTotal) * 100).toFixed(2)}%">`)
    .join("");

  const headerHalf =
    '<td rowspan="2">날짜</td><td colspan="2">출근</td><td rowspan="2">결근</td><td rowspan="2">참여자<br>서명</td>';

  // 좌(1~16일)/우(17~31일) 2단
  const dayRows = Array.from({ length: DAYS_PER_COLUMN }, (_, index) => {
    const leftDay = participant.days[index];
    const rightDay = participant.days[index + DAYS_PER_COLUMN];
    return `<tr class="day">${renderDayCells(monthNum, leftDay)}${renderDayCells(monthNum, rightDay)}</tr>`;
  }).join("");

  // 근무결과 요약(실제 집계)
  const presentDays = participant.days.filter((day) => day.marker === "PRESENT").length;
  const absentDays = participant.days.filter((day) => day.marker === "ABSENT").length;
  const totalMinutes = participant.days.reduce(
    (sum, day) => sum + (day.marker === "PRESENT" ? (day.totalMinutes ?? 0) : 0),
    0,
  );
  const totalHoursLabel = `${Math.floor(totalMinutes / 60)}시간 ${totalMinutes % 60}분`;

  return `
<div class="attendance-page">
  <h1>노인역량활용사업 월별 참여자 출근부(${monthNum}월)</h1>
  <table>
    <colgroup>${colgroup}</colgroup>
    <tr class="info">
      <td colspan="5">사업단명 : ${escapeHtml(programName)}</td>
      <td colspan="5">참여자 성명 : ${escapeHtml(participant.name)} (${escapeHtml(participant.groupName)})</td>
    </tr>
    <tr class="header" style="height:22px">${headerHalf}${headerHalf}</tr>
    <tr class="header" style="height:30px">
      <td>근무시작<br>시간</td><td>근무종료<br>시간</td>
      <td>근무시작<br>시간</td><td>근무종료<br>시간</td>
    </tr>
    ${dayRows}
    <tr class="result">
      <td rowspan="2"><b>근무<br>결과</b></td>
      <td colspan="2">출근(${totalHoursLabel})</td>
      <td colspan="2">${presentDays}일</td>
      <td colspan="5" rowspan="2">확인자: 참여자 근무내역을 확인 후 월 1회 서명 (인/서명)</td>
    </tr>
    <tr class="result">
      <td colspan="2">결근</td>
      <td colspan="2">${absentDays}일</td>
    </tr>
    <tr class="note">
      <td rowspan="2"><b>특이<br>사항</b></td>
      <td colspan="9" class="text">○ 수행기관 관계자(확인자)는 참여자 근무현장을 정기 방문할 경우 방문 일시 작성, 서명하기<br>- 방문일시 : ${month.slice(0, 4)}년 ${monthNum}월 &nbsp;&nbsp;&nbsp;일 &nbsp;&nbsp;&nbsp;시 &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;- 방문자 : &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;(서명)</td>
    </tr>
    <tr class="note">
      <td colspan="9" class="text">○ 참여자 관련 특이사항, 근무 특이사항 기록</td>
    </tr>
  </table>
  <div class="guide">
    ※ 작성요령：<br>
    &nbsp;- 근무일자와 근무시작시간, 근무종료시간 작성<br>
    &nbsp;- 출근 시 참여자는 참여자 서명란에 서명(서명 예시：홍길동, 홍, 지장 가능 / 단, 도장은 불가)<br>
    &nbsp;- 지각·조퇴 시에는 실제로 근무한 시간 명시<br>
    &nbsp;- 결근은 결근란에 표시<br>
    &nbsp;- 수행기관 확인자는 참여자 근무내역 확인 후 월 1회 서명(서명 예시：홍길동, 홍, 지장 또는 도장)
  </div>
  <div class="banner">${withLineBreaks(bannerText)}</div>
</div>`;
};

/**
 * 💡 사업단 1개월치 역량활용 출근부를 참여자 1명당 A4 한 장으로 만들어 PDF로 바로 다운로드합니다.
 * 예전 엑셀 출근부(참여자별 시트)와 같은 서식이다.
 */
export const downloadCapacityAttendancePdf = async (
  programName: string,
  month: string,
  participants: CapacityAttendanceParticipant[],
  bannerText?: string | null,
): Promise<void> => {
  const banner = bannerText || DEFAULT_CAPACITY_ATTENDANCE_BANNER_TEXT;

  // 화면 밖 래퍼 안에 실제 내용(위치 지정 없는 div)을 그리고 그 안쪽 div를 넘긴다 — html2pdf는
  // 넘긴 요소를 복제해서 캡처하는데, 위치를 옮긴 요소를 바로 넘기면 그 위치까지 복제돼 빈
  // 페이지가 나오고, 문자열로 넘기면 <style>이 적용되지 않는다.
  const wrapper = document.createElement("div");
  wrapper.style.position = "fixed";
  wrapper.style.left = "-10000px";
  wrapper.style.top = "0";
  const content = document.createElement("div");
  content.innerHTML =
    `<style>${PAGE_STYLE}</style>` +
    (participants.length > 0
      ? participants
          .map((participant) => renderParticipantPage(programName, month, participant, banner))
          .join("")
      : `<div class="attendance-page"><h1>노인역량활용사업 월별 참여자 출근부(${Number(month.slice(5, 7))}월)</h1></div>`);
  wrapper.appendChild(content);
  document.body.appendChild(wrapper);

  // Tailwind 기본 스타일(img { display: block })이 html2canvas의 글자 기준선 측정(body 바로
  // 아래에 잠깐 붙이는 측정용 div 안의 img)을 틀어서 모든 글자가 칸 아래로 처진다. 캡처하는
  // 동안만 그 측정용 img를 inline으로 되돌린다.
  const baselineFix = document.createElement("style");
  baselineFix.textContent = "body > div > img { display: inline !important; }";
  document.head.appendChild(baselineFix);

  try {
    const worker = new html2pdf.Worker();
    // html2pdf.js 타입 정의에 pagebreak 옵션이 빠져 있어서 그 필드만 덧붙인다
    type PdfOptions = Parameters<typeof worker.set>[0] & { pagebreak?: { mode?: string[] } };
    await worker
      .set({
        margin: [10, 10, 10, 10],
        filename: `출근부_${month}.pdf`,
        image: { type: "jpeg", quality: 0.95 },
        html2canvas: {
          scale: 2,
          useCORS: true,
          // 관리자 화면을 스크롤한 상태에서 눌러도 오른쪽·아래가 잘리지 않게 캡처 기준을 고정한다
          scrollX: 0,
          scrollY: 0,
          windowWidth: 1200,
        },
        jsPDF: { unit: "mm", format: "a4", orientation: "portrait" },
        // 참여자마다 새 페이지에서 시작한다(.attendance-page + .attendance-page의 page-break-before)
        pagebreak: { mode: ["css"] },
      } as PdfOptions)
      .from(content)
      .save();
  } finally {
    wrapper.remove();
    baselineFix.remove();
  }
};

import ExcelJS from "exceljs";

type CapacityAttendanceMarker = "HOLIDAY" | "WEEKEND" | "PRESENT" | "ABSENT" | "NONE";

interface CapacityAttendanceDay {
  day: number;
  date: string;
  marker: CapacityAttendanceMarker;
  label?: string;
  startTime?: string | null;
  endTime?: string | null;
  totalMinutes?: number | null;
  signatureBase64?: string | null;
}

export interface CapacityAttendanceParticipant {
  name: string;
  groupName: string;
  shiftStart: string | null;
  shiftEnd: string | null;
  days: CapacityAttendanceDay[];
}

// color를 안 주면 스펙상 automatic(보통 검정)이지만, 구글 시트는 xlsx를 가져올 때
// color가 없는 테두리를 안 그리는 경우가 있어서 명시적으로 검정을 지정한다.
const THIN_BORDER = { style: "thin" as const, color: { argb: "FF000000" } };
const CENTER = { horizontal: "center" as const, vertical: "middle" as const };
const WEEKEND_FILL: ExcelJS.Fill = {
  type: "pattern",
  pattern: "solid",
  fgColor: { argb: "FFD9D9D9" },
};

// 시트명은 31자 제한 + \ / ? * [ ] : 사용 불가, 동명이인은 (2), (3)으로 구분
const sanitizeSheetName = (name: string, usedNames: Set<string>) => {
  const base = name.replace(/[\\/?*[\]:]/g, "").slice(0, 31) || "참여자";
  let candidate = base;
  let suffix = 2;
  while (usedNames.has(candidate)) {
    candidate = `${base.slice(0, 27)}(${suffix})`;
    suffix += 1;
  }
  usedNames.add(candidate);
  return candidate;
};

// 열 순서(반쪽당 5열): 날짜 · 근무시작시간 · 근무종료시간 · 결근 · 참여자서명
const COL_COUNT_PER_HALF = 5;

export const DEFAULT_CAPACITY_ATTENDANCE_BANNER_TEXT =
  "안전수칙을 지켜서 즐겁고 안전한 일자리를 우리가 만들어요!\n" +
  "안전한 복장 착용하기 ⇒ 안전하게 이동하기 ⇒ 간단한 스트레칭하기\n" +
  "※ 주변 잘 살피고 장애물은 내가 먼저 치우기";

const addCapacityAttendanceSheet = (
  workbook: ExcelJS.Workbook,
  sheetName: string,
  programName: string,
  month: string,
  participant: CapacityAttendanceParticipant,
  bannerText: string | null | undefined,
): void => {
  const sheet = workbook.addWorksheet(sheetName);
  const monthNum = Number(month.slice(5, 7));
  sheet.pageSetup = { paperSize: 9, orientation: "portrait", fitToPage: true };

  const halfWidths = [10, 11, 11, 7, 11];
  sheet.columns = [...halfWidths, ...halfWidths].map((width) => ({ width }));

  const colLetter = (colNumber: number) => {
    let n = colNumber;
    let result = "";
    while (n > 0) {
      const rem = (n - 1) % 26;
      result = String.fromCharCode(65 + rem) + result;
      n = Math.floor((n - 1) / 26);
    }
    return result;
  };
  const totalCols = COL_COUNT_PER_HALF * 2;

  // 1. 제목
  sheet.mergeCells(`A1:${colLetter(totalCols)}1`);
  sheet.getCell("A1").value = `노인역량활용사업 월별 참여자 출근부(${monthNum}월)`;
  sheet.getCell("A1").font = { size: 16, bold: true };
  sheet.getCell("A1").alignment = CENTER;
  sheet.getRow(1).height = 28;

  // 2. 사업단명 / 참여자 성명
  const halfCol = COL_COUNT_PER_HALF;
  sheet.mergeCells(`A2:${colLetter(halfCol)}2`);
  sheet.getCell("A2").value = `사업단명 : ${programName}`;
  sheet.getCell("A2").alignment = { horizontal: "left", vertical: "middle" };
  sheet.mergeCells(`${colLetter(halfCol + 1)}2:${colLetter(totalCols)}2`);
  sheet.getCell(`${colLetter(halfCol + 1)}2`).value =
    `참여자 성명 : ${participant.name} (${participant.groupName})`;
  sheet.getCell(`${colLetter(halfCol + 1)}2`).alignment = {
    horizontal: "left",
    vertical: "middle",
  };
  sheet.getRow(2).height = 22;

  // 3. 좌(1~16일)/우(17~31일) 2단, 반쪽당 5열(월일 병합칸 포함) 2행 헤더
  const HEADER_ROW_1 = 3;
  const HEADER_ROW_2 = 4;
  [0, COL_COUNT_PER_HALF].forEach((offset) => {
    const c = (index: number) => colLetter(offset + index + 1);
    sheet.mergeCells(`${c(0)}${HEADER_ROW_1}:${c(0)}${HEADER_ROW_2}`);
    sheet.getCell(`${c(0)}${HEADER_ROW_1}`).value = "날짜";

    sheet.mergeCells(`${c(1)}${HEADER_ROW_1}:${c(2)}${HEADER_ROW_1}`);
    sheet.getCell(`${c(1)}${HEADER_ROW_1}`).value = "출근";
    sheet.getCell(`${c(1)}${HEADER_ROW_2}`).value = "근무시작\n시간";
    sheet.getCell(`${c(2)}${HEADER_ROW_2}`).value = "근무종료\n시간";

    sheet.mergeCells(`${c(3)}${HEADER_ROW_1}:${c(3)}${HEADER_ROW_2}`);
    sheet.getCell(`${c(3)}${HEADER_ROW_1}`).value = "결근";

    sheet.mergeCells(`${c(4)}${HEADER_ROW_1}:${c(4)}${HEADER_ROW_2}`);
    sheet.getCell(`${c(4)}${HEADER_ROW_1}`).value = "참여자\n서명";
  });
  sheet.getRow(HEADER_ROW_1).height = 20;
  sheet.getRow(HEADER_ROW_2).height = 26;
  sheet.getRow(HEADER_ROW_1).font = { bold: true };
  sheet.getRow(HEADER_ROW_2).font = { bold: true };
  [HEADER_ROW_1, HEADER_ROW_2].forEach((rowNumber) => {
    sheet.getRow(rowNumber).eachCell({ includeEmpty: true }, (cell) => {
      cell.alignment = { ...CENTER, wrapText: true };
    });
  });

  const DATA_START_ROW = 5;

  const writeDayCell = (rowIdx: number, offset: number, day: CapacityAttendanceDay) => {
    const c = (index: number) => colLetter(offset + index + 1);
    const dayCell = sheet.getCell(`${c(0)}${rowIdx}`);
    dayCell.value = `${monthNum}월 ${day.day}일`;

    if (day.marker === "HOLIDAY") {
      const cell = sheet.getCell(`${c(4)}${rowIdx}`);
      cell.value = day.label ?? "공휴일";
      cell.font = { color: { argb: "FFFF0000" }, bold: true };
      return;
    }
    if (day.marker === "WEEKEND") {
      // 공식 서식(2.역량활동_출근부.pdf)은 주말에 별도 텍스트 없이 행 전체를
      // 회색으로 칠해서 휴무일임을 표시한다.
      for (let index = 0; index < COL_COUNT_PER_HALF; index++) {
        sheet.getCell(`${c(index)}${rowIdx}`).fill = WEEKEND_FILL;
      }
      return;
    }
    if (day.marker === "PRESENT") {
      sheet.getCell(`${c(1)}${rowIdx}`).value = day.startTime ?? "";
      sheet.getCell(`${c(2)}${rowIdx}`).value = day.endTime ?? "";
      if (day.signatureBase64) {
        try {
          const imageId = workbook.addImage({
            base64: `data:image/png;base64,${day.signatureBase64}`,
            extension: "png",
          });
          sheet.addImage(imageId, {
            tl: { col: offset + 4, row: rowIdx - 1 },
            ext: { width: 45, height: 20 },
          });
        } catch {
          // 서명 이미지가 깨져있어도 출근부 자체는 정상 출력되게 무시한다
        }
      }
      return;
    }
    if (day.marker === "ABSENT") {
      const cell = sheet.getCell(`${c(3)}${rowIdx}`);
      cell.value = "결근";
      cell.font = { color: { argb: "FFC0392B" }, bold: true };
    }
  };

  const lastDay = participant.days.length;
  for (let day = 1; day <= 16; day++) {
    const rowIdx = DATA_START_ROW + day - 1;
    const leftDay = participant.days[day - 1];
    if (leftDay) writeDayCell(rowIdx, 0, leftDay);

    const rightDayNumber = day + 16;
    if (rightDayNumber <= lastDay) {
      const rightDay = participant.days[rightDayNumber - 1];
      if (rightDay) writeDayCell(rowIdx, COL_COUNT_PER_HALF, rightDay);
    }
  }

  // 5. 근무결과 요약(실제 집계) + 확인자 서명란
  const presentDays = participant.days.filter((day) => day.marker === "PRESENT").length;
  const absentDays = participant.days.filter((day) => day.marker === "ABSENT").length;
  const totalMinutes = participant.days.reduce(
    (sum, day) => sum + (day.marker === "PRESENT" ? (day.totalMinutes ?? 0) : 0),
    0,
  );
  const totalHoursLabel = `${Math.floor(totalMinutes / 60)}시간 ${totalMinutes % 60}분`;

  const resultRow1 = DATA_START_ROW + 16;
  const resultRow2 = resultRow1 + 1;
  const c1 = (index: number) => colLetter(index + 1);

  sheet.mergeCells(`${c1(0)}${resultRow1}:${c1(0)}${resultRow2}`);
  sheet.getCell(`${c1(0)}${resultRow1}`).value = "근무\n결과";
  sheet.getCell(`${c1(0)}${resultRow1}`).font = { bold: true };

  sheet.mergeCells(`${c1(1)}${resultRow1}:${c1(2)}${resultRow1}`);
  sheet.getCell(`${c1(1)}${resultRow1}`).value = `출근(${totalHoursLabel})`;
  sheet.mergeCells(`${c1(3)}${resultRow1}:${c1(4)}${resultRow1}`);
  sheet.getCell(`${c1(3)}${resultRow1}`).value = `${presentDays}일`;

  sheet.mergeCells(`${c1(1)}${resultRow2}:${c1(2)}${resultRow2}`);
  sheet.getCell(`${c1(1)}${resultRow2}`).value = "결근";
  sheet.mergeCells(`${c1(3)}${resultRow2}:${c1(4)}${resultRow2}`);
  sheet.getCell(`${c1(3)}${resultRow2}`).value = `${absentDays}일`;

  sheet.mergeCells(`${c1(5)}${resultRow1}:${c1(9)}${resultRow2}`);
  sheet.getCell(`${c1(5)}${resultRow1}`).value =
    "확인자: 참여자 근무내역을 확인 후 월 1회 서명 (인/서명)";
  sheet.getCell(`${c1(5)}${resultRow1}`).alignment = {
    ...CENTER,
    wrapText: true,
  };

  // 6. 특이사항
  const noteRow1 = resultRow2 + 1;
  const noteRow2 = noteRow1 + 1;
  sheet.mergeCells(`${c1(0)}${noteRow1}:${c1(0)}${noteRow2}`);
  sheet.getCell(`${c1(0)}${noteRow1}`).value = "특이\n사항";
  sheet.getCell(`${c1(0)}${noteRow1}`).font = { bold: true };

  sheet.mergeCells(`${c1(1)}${noteRow1}:${c1(9)}${noteRow1}`);
  sheet.getCell(`${c1(1)}${noteRow1}`).value =
    `○ 수행기관 관계자(확인자)는 참여자 근무현장을 정기 방문할 경우 방문 일시 작성, 서명하기\n- 방문일시 : ${month.slice(0, 4)}년 ${monthNum}월    일    시            - 방문자 :        (서명)`;
  sheet.getCell(`${c1(1)}${noteRow1}`).alignment = {
    horizontal: "left",
    vertical: "middle",
    wrapText: true,
  };

  sheet.mergeCells(`${c1(1)}${noteRow2}:${c1(9)}${noteRow2}`);
  sheet.getCell(`${c1(1)}${noteRow2}`).value = "○ 참여자 관련 특이사항, 근무 특이사항 기록";
  sheet.getCell(`${c1(1)}${noteRow2}`).alignment = {
    horizontal: "left",
    vertical: "middle",
  };

  // 7. 테두리/정렬 일괄 적용 (제목 행 제외)
  for (let rowNumber = 2; rowNumber <= noteRow2; rowNumber++) {
    sheet.getRow(rowNumber).eachCell({ includeEmpty: true }, (cell) => {
      cell.border = {
        ...cell.border,
        top: THIN_BORDER,
        left: THIN_BORDER,
        bottom: THIN_BORDER,
        right: THIN_BORDER,
      };
      if (!cell.alignment) cell.alignment = CENTER;
    });
  }

  // 8. 작성요령
  const guideRow = noteRow2 + 2;
  sheet.mergeCells(`${c1(0)}${guideRow}:${c1(9)}${guideRow}`);
  sheet.getCell(`${c1(0)}${guideRow}`).value =
    "※ 작성요령：\n" +
    " - 근무일자와 근무시작시간, 근무종료시간 작성\n" +
    " - 출근 시 참여자는 참여자 서명란에 서명(서명 예시：홍길동, 홍, 지장 가능 / 단, 도장은 불가)\n" +
    " - 지각·조퇴 시에는 실제로 근무한 시간 명시\n" +
    " - 결근은 결근란에 표시\n" +
    " - 수행기관 확인자는 참여자 근무내역 확인 후 월 1회 서명(서명 예시：홍길동, 홍, 지장 또는 도장)";
  sheet.getCell(`${c1(0)}${guideRow}`).font = { size: 9 };
  sheet.getCell(`${c1(0)}${guideRow}`).alignment = {
    horizontal: "left",
    vertical: "top",
    wrapText: true,
  };
  sheet.getRow(guideRow).height = 90;

  // 9. 안전수칙 배너
  const bannerRow = guideRow + 1;
  sheet.mergeCells(`${c1(0)}${bannerRow}:${c1(9)}${bannerRow}`);
  sheet.getCell(`${c1(0)}${bannerRow}`).value =
    bannerText || DEFAULT_CAPACITY_ATTENDANCE_BANNER_TEXT;
  sheet.getCell(`${c1(0)}${bannerRow}`).font = {
    bold: true,
    size: 12,
    color: { argb: "FFC0392B" },
  };
  sheet.getCell(`${c1(0)}${bannerRow}`).alignment = {
    ...CENTER,
    wrapText: true,
  };
  sheet.getRow(bannerRow).height = 60;
};

/**
 * 💡 사업단 1개월치 역량활용 출근부를 참여자별 시트로 만들어 바로 다운로드합니다.
 */
export const downloadCapacityAttendanceWorkbook = async (
  programName: string,
  month: string,
  participants: CapacityAttendanceParticipant[],
  bannerText?: string | null,
): Promise<void> => {
  const workbook = new ExcelJS.Workbook();
  const usedSheetNames = new Set<string>();

  participants.forEach((participant) => {
    addCapacityAttendanceSheet(
      workbook,
      sanitizeSheetName(participant.name, usedSheetNames),
      programName,
      month,
      participant,
      bannerText,
    );
  });

  if (participants.length === 0) {
    workbook.addWorksheet("출근부");
  }

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `출근부_${month}.xlsx`;
  link.click();
  URL.revokeObjectURL(link.href);
};

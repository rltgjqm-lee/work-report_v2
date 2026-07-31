import ExcelJS from "exceljs";

export interface WorkScheduleHeader {
  organizationName: string;
  organizationRep: string;
  organizationAddress: string;
  month: string; // "YYYY-MM"
}

export interface WorkScheduleParticipant {
  name: string;
  groupName: string;
  shiftStart: string | null;
  shiftEnd: string | null;
  createdAt: string; // ISO
  scheduledDates: string[]; // "YYYY-MM-DD"
  unpaidLeaveDays: number;
  paidLeaveDays: number;
  presentDays: number;
}

const WEEKDAY_LABELS = ["일", "월", "화", "수", "목", "금", "토"];
// color 없이 style만 주면 구글 시트가 xlsx 가져올 때 테두리를 안 그리는 문제가 있어서
// 명시적으로 검정을 지정한다 (역량활동 출근부 작업에서 확인된 이슈).
const THIN_BORDER = { style: "thin" as const, color: { argb: "FF000000" } };
const CENTER = { horizontal: "center" as const, vertical: "middle" as const };
const HEADER_FILL: ExcelJS.Fill = {
  type: "pattern",
  pattern: "solid",
  fgColor: { argb: "FF1E3A5F" },
};

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

// 시급/시간 계산은 "HH:MM" 문자열 기준
const hourOf = (time: string) => Number(time.slice(0, 2));
const diffHours = (start: string, end: string) => {
  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);
  return (eh * 60 + em - (sh * 60 + sm)) / 60;
};
// 안내문 규칙: 4시간 이상 근무 시 30분, 8시간 근무 시 1시간 휴게 부여
const breakHoursFor = (workHours: number) => {
  if (workHours >= 8) return 1;
  if (workHours >= 4) return 0.5;
  return 0;
};

const addWorkScheduleSheet = (
  workbook: ExcelJS.Workbook,
  sheetName: string,
  header: WorkScheduleHeader,
  participant: WorkScheduleParticipant,
): void => {
  const sheet = workbook.addWorksheet(sheetName);
  const [yearStr, monthStr] = header.month.split("-");
  const year = Number(yearStr);
  const monthNum = Number(monthStr);
  sheet.pageSetup = { paperSize: 9, orientation: "portrait", fitToPage: true };

  const COL_COUNT = 14; // 요일 7개 × (근무일/휴무일) 2열
  sheet.columns = Array.from({ length: COL_COUNT }, () => ({ width: 7 }));

  // 1. 제목
  sheet.mergeCells(`A1:${colLetter(COL_COUNT)}1`);
  sheet.getCell("A1").value =
    `${year}년 ${monthNum}월 근무스케줄표 ( 무급휴무 ${participant.unpaidLeaveDays}회, ` +
    `유급휴무 ${participant.paidLeaveDays}회, 실제근무 ${participant.presentDays}회 )`;
  sheet.getCell("A1").font = {
    size: 14,
    bold: true,
    color: { argb: "FFFFFFFF" },
  };
  sheet.getCell("A1").fill = HEADER_FILL;
  sheet.getCell("A1").alignment = CENTER;
  sheet.getRow(1).height = 24;

  // 2. 요일 헤더
  WEEKDAY_LABELS.forEach((label, weekday) => {
    const startCol = weekday * 2 + 1;
    sheet.mergeCells(`${colLetter(startCol)}2:${colLetter(startCol + 1)}2`);
    const cell = sheet.getCell(`${colLetter(startCol)}2`);
    cell.value = label;
    cell.font = { bold: true };
  });
  sheet.getRow(2).height = 18;

  // 3. 달력 본문 — 일요일 시작, 주 단위로 [날짜] / [근무일·휴무일] / [○ 표시] 3행씩
  const firstOfMonth = new Date(Date.UTC(year, monthNum - 1, 1));
  const daysInMonth = new Date(Date.UTC(year, monthNum, 0)).getUTCDate();
  const startWeekday = firstOfMonth.getUTCDay(); // 0=일요일
  const totalCells = startWeekday + daysInMonth;
  const totalWeeks = Math.ceil(totalCells / 7);

  const employedFrom = participant.createdAt.slice(0, 10);
  const contractMarkDate = employedFrom.slice(0, 7) === header.month ? employedFrom : null;

  let currentRow = 3;
  for (let week = 0; week < totalWeeks; week++) {
    const dateRow = currentRow;
    const labelRow = currentRow + 1;
    const markRow = currentRow + 2;

    for (let weekday = 0; weekday < 7; weekday++) {
      const cellIndex = week * 7 + weekday;
      const dayNumber = cellIndex - startWeekday + 1;
      const startCol = weekday * 2 + 1;
      const workColLetter = colLetter(startCol);
      const offColLetter = colLetter(startCol + 1);

      sheet.mergeCells(`${workColLetter}${dateRow}:${offColLetter}${dateRow}`);
      sheet.getCell(`${workColLetter}${labelRow}`).value = "근무일";
      sheet.getCell(`${offColLetter}${labelRow}`).value = "휴무일";

      if (dayNumber < 1 || dayNumber > daysInMonth) continue; // 이전/다음 달 빈 칸

      const date = `${header.month}-${String(dayNumber).padStart(2, "0")}`;
      const dateCell = sheet.getCell(`${workColLetter}${dateRow}`);
      dateCell.value = date === contractMarkDate ? `${dayNumber} 근로계약` : dayNumber;
      dateCell.font = { bold: true };

      if (date < employedFrom) continue; // 입사 전이라 근무/휴무 표시 없음

      const isWorkDay = participant.scheduledDates.includes(date);
      sheet.getCell(`${isWorkDay ? workColLetter : offColLetter}${markRow}`).value = "○";
    }

    currentRow += 3;
  }

  const calendarEndRow = currentRow - 1;
  for (let rowNumber = 1; rowNumber <= calendarEndRow; rowNumber++) {
    sheet.getRow(rowNumber).eachCell({ includeEmpty: true }, (cell) => {
      cell.border = {
        top: THIN_BORDER,
        left: THIN_BORDER,
        bottom: THIN_BORDER,
        right: THIN_BORDER,
      };
      if (!cell.alignment) cell.alignment = CENTER;
    });
  }

  // 4. 근로시간 안내 + 사용자/근로자 정보
  const workHours =
    participant.shiftStart && participant.shiftEnd
      ? diffHours(participant.shiftStart, participant.shiftEnd)
      : null;
  const infoStartRow = calendarEndRow + 2;
  const c = (index: number) => colLetter(index + 1);

  sheet.mergeCells(`${c(0)}${infoStartRow}:${c(3)}${infoStartRow}`);
  sheet.getCell(`${c(0)}${infoStartRow}`).value = `1일 소정근로시간 : ( ${workHours ?? ""} )시간`;
  sheet.mergeCells(`${c(0)}${infoStartRow + 1}:${c(3)}${infoStartRow + 1}`);
  sheet.getCell(`${c(0)}${infoStartRow + 1}`).value =
    `시업시간 ( ${participant.shiftStart ? hourOf(participant.shiftStart) : ""} )시`;
  sheet.mergeCells(`${c(0)}${infoStartRow + 2}:${c(3)}${infoStartRow + 2}`);
  sheet.getCell(`${c(0)}${infoStartRow + 2}`).value =
    `종업시간 ( ${participant.shiftEnd ? hourOf(participant.shiftEnd) : ""} )시`;
  sheet.mergeCells(`${c(0)}${infoStartRow + 3}:${c(3)}${infoStartRow + 3}`);
  sheet.getCell(`${c(0)}${infoStartRow + 3}`).value =
    `휴게시간 ( ${workHours !== null ? breakHoursFor(workHours) : ""} )시` +
    " ※ 4시간 이상 근무 시 30분, 8시간 근무 시 1시간 휴게 부여";
  [0, 1, 2, 3].forEach((offset) => {
    sheet.getCell(`${c(0)}${infoStartRow + offset}`).alignment = {
      horizontal: "left",
      vertical: "middle",
    };
  });

  sheet.mergeCells(`${c(4)}${infoStartRow}:${c(8)}${infoStartRow}`);
  sheet.getCell(`${c(4)}${infoStartRow}`).value = "(사용자)";
  sheet.getCell(`${c(4)}${infoStartRow}`).font = { bold: true };
  sheet.mergeCells(`${c(4)}${infoStartRow + 1}:${c(8)}${infoStartRow + 1}`);
  sheet.getCell(`${c(4)}${infoStartRow + 1}`).value = `기관명 : ${header.organizationName}`;
  sheet.mergeCells(`${c(4)}${infoStartRow + 2}:${c(8)}${infoStartRow + 2}`);
  sheet.getCell(`${c(4)}${infoStartRow + 2}`).value = `대표자 : ${header.organizationRep} (인)`;
  sheet.mergeCells(`${c(4)}${infoStartRow + 3}:${c(8)}${infoStartRow + 3}`);
  sheet.getCell(`${c(4)}${infoStartRow + 3}`).value = `소재지 : ${header.organizationAddress}`;
  [0, 1, 2, 3].forEach((offset) => {
    sheet.getCell(`${c(4)}${infoStartRow + offset}`).alignment = {
      horizontal: "left",
      vertical: "middle",
    };
  });

  sheet.mergeCells(`${c(9)}${infoStartRow}:${c(13)}${infoStartRow}`);
  sheet.getCell(`${c(9)}${infoStartRow}`).value = "(근로자)";
  sheet.getCell(`${c(9)}${infoStartRow}`).font = { bold: true };
  sheet.mergeCells(`${c(9)}${infoStartRow + 1}:${c(13)}${infoStartRow + 1}`);
  sheet.getCell(`${c(9)}${infoStartRow + 1}`).value = `성 명 : ${participant.name} (인)`;
  sheet.mergeCells(`${c(9)}${infoStartRow + 2}:${c(13)}${infoStartRow + 2}`);
  sheet.getCell(`${c(9)}${infoStartRow + 2}`).value = "연락처 :";
  sheet.mergeCells(`${c(9)}${infoStartRow + 3}:${c(13)}${infoStartRow + 3}`);
  sheet.getCell(`${c(9)}${infoStartRow + 3}`).value = "주 소 :";
  [0, 1, 2, 3].forEach((offset) => {
    sheet.getCell(`${c(9)}${infoStartRow + offset}`).alignment = {
      horizontal: "left",
      vertical: "middle",
    };
  });

  // 5. 하단 안내 문구
  const noteRow = infoStartRow + 5;
  sheet.mergeCells(`${c(0)}${noteRow}:${c(13)}${noteRow}`);
  sheet.getCell(`${c(0)}${noteRow}`).value =
    "* 참여자(근로자) 성명 및 서명란은 필히 정자(사인불가)로 기재 후 출근부 제출 시 같이 제출.";
  sheet.mergeCells(`${c(0)}${noteRow + 1}:${c(13)}${noteRow + 1}`);
  sheet.getCell(`${c(0)}${noteRow + 1}`).value =
    "* 휴무일은 수요처와 근로자간 상의 후 휴무일 결정. 근무일, 휴무일에 맞게 '○' 표시 부탁드립니다.";
  [0, 1].forEach((offset) => {
    const cell = sheet.getCell(`${c(0)}${noteRow + offset}`);
    cell.font = { size: 9, color: { argb: "FFC0392B" } };
    cell.alignment = { horizontal: "left", vertical: "middle" };
  });
};

/**
 * 💡 사업단 1개월치 근무스케줄표(근로계약서 첨부용)를 참여자별 시트로 만들어 다운로드합니다.
 */
export const downloadWorkScheduleWorkbook = async (
  header: WorkScheduleHeader,
  participants: WorkScheduleParticipant[],
): Promise<void> => {
  const workbook = new ExcelJS.Workbook();
  const usedSheetNames = new Set<string>();

  participants.forEach((participant) => {
    addWorkScheduleSheet(
      workbook,
      sanitizeSheetName(participant.name, usedSheetNames),
      header,
      participant,
    );
  });

  if (participants.length === 0) {
    workbook.addWorksheet("근무스케줄표");
  }

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `근무스케줄표_${header.month}.xlsx`;
  link.click();
  URL.revokeObjectURL(link.href);
};

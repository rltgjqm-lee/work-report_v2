import ExcelJS from "exceljs";

export interface PaymentLedgerHeader {
  programName: string;
  month: string; // "YYYY-MM"
  healthInsuranceRate: number; // %
  longtermCareRate: number; // % (건강보험료 대비)
  employmentInsuranceRate: number; // % (개인부담)
  employmentInsuranceEmployerRate: number; // % (기관부담)
  industrialAccidentRate: number; // % (기관부담, 전액 사업주 부담)
}

export interface PaymentLedgerParticipant {
  name: string;
  actualWorkHours: number;
  trainingHours: number;
  paidLeaveHours: number;
  // 평일 공휴일(대체공휴일·노동절 포함) 유급 1일 3시간 — 그 공휴일 당시 재직자만
  holidayPaidHours: number;
  // 주휴 구간·만근·연차 발생 기준 — 출근한 소정근로일은 지각·조퇴와 상관없이 전체 인정
  recognizedHours: number;
  weeklyHolidayHours: number;
  // 계약 종료 달에만 값이 있다 (미사용 연차는 계약 종료 시 정산)
  remainingLeaveHours: number;
  teamLeaderAllowance: number;
  hourlyWage: number;
  healthInsuranceEnrolled: boolean;
  longtermCareInsuranceEnrolled: boolean;
  employmentInsuranceEnrolled: boolean;
  industrialAccidentInsuranceEnrolled: boolean;
}

// color 없이 style만 주면 구글 시트가 xlsx를 가져올 때 테두리를 안 그리는 문제가 있어서
// 명시적으로 검정을 지정한다.
const THIN = { style: "thin" as const, color: { argb: "FF000000" } };
const MEDIUM = { style: "medium" as const, color: { argb: "FF000000" } };
const CENTER = {
  horizontal: "center" as const,
  vertical: "middle" as const,
  wrapText: true,
};
const MONEY_FMT = '_-* #,##0_-;-* #,##0_-;_-* "-"_-;_-@_-';

const HEADER_FILL: ExcelJS.Fill = {
  type: "pattern",
  pattern: "solid",
  fgColor: { argb: "FFE6E0EC" },
};
const TOTAL_FILL: ExcelJS.Fill = {
  type: "pattern",
  pattern: "solid",
  fgColor: { argb: "FFB7DEE8" },
};
const COMPUTED_FILL: ExcelJS.Fill = {
  type: "pattern",
  pattern: "solid",
  fgColor: { argb: "FFDBEEF4" },
};

// 원본 서식 33열에 공휴일 유급시간(N)·팀장수당(AE) 두 열을 더했다.
const COL_COUNT = 35; // A~AI
const COL_WIDTHS = [
  5, 7.75, 7.75, 7.75, 10.75, 3.75, 3.75, 7.75, 7.75, 7.75, 6.875, 7.375, 7.75, 7.75, 5.75, 10.75,
  7.75, 7.75, 7.75, 10.75, 7.75, 7.75, 7.75, 7.75, 10.75, 10.75, 5.75, 8.75, 5.75, 8.75, 8.75,
  10.75, 10.75, 10.75, 8.875,
];
// 원본 서식의 열 그룹 경계(굵은 테두리) — 이 열의 왼쪽/오른쪽에 medium 테두리를 준다.
const LEFT_MEDIUM_COLS = new Set([1, 9, 17, 21, 26, 27, 34]);
const RIGHT_MEDIUM_COLS = new Set([16, 25, 26, 32, 34, 35]);
// 계산된(수식) 값이 들어가는 열 — 원본에서 옅은 청록색으로 구분해뒀다.
const COMPUTED_COLS = new Set([
  9, 10, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 28, 30, 32, 33, 34,
]);
// 금액이지만 직접 넣는 값이라 색은 칠하지 않는 열 — 시간당 단가(H), 팀장수당(AE)
const MONEY_INPUT_COLS = new Set([8, 31]);

const colLetter = (n: number) => {
  let result = "";
  while (n > 0) {
    const rem = (n - 1) % 26;
    result = String.fromCharCode(65 + rem) + result;
    n = Math.floor((n - 1) / 26);
  }
  return result;
};

/**
 * 💡 사업단 1개월치 급여대장을 실제 서식(work-report-v4/서식(1)/역량활용/2026ESG
 * 급여대장.xlsx의 "인건비 (6)" 시트) 구조에 공휴일 유급시간·팀장수당 열을 더해 만들어
 * 다운로드합니다. 주휴시간·연차 정산·팀장수당은 2026년 노인역량활용사업 임금산정 기준대로
 * 서버가 계산한 값을 넣고(worker/src/lib/capacityPayroll.ts), 결근·조퇴시간/은행/계좌/
 * 생년월일은 우리 시스템에 없는 데이터라 빈 칸으로 둔다.
 */
export const downloadPaymentLedgerWorkbook = async (
  header: PaymentLedgerHeader,
  participants: PaymentLedgerParticipant[],
): Promise<void> => {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("급여대장");
  const monthNum = Number(header.month.slice(5, 7));
  sheet.pageSetup = {
    paperSize: 9,
    orientation: "landscape",
    fitToPage: true,
    fitToWidth: 1,
  };
  sheet.columns = COL_WIDTHS.map((width) => ({ width }));

  const ROW_TITLE = 1;
  const ROW_SETTINGS = 2;
  const ROW_HEADER1 = 3;
  const ROW_HEADER2 = 4;
  const ROW_TOTAL = 5;
  const DATA_START = 6;
  const dataEnd = DATA_START + Math.max(participants.length, 1) - 1;
  const ROW_NOTES = dataEnd + 1;
  const lastCol = colLetter(COL_COUNT);

  // 1. 제목
  sheet.mergeCells(`A${ROW_TITLE}:${lastCol}${ROW_TITLE}`);
  sheet.getCell(`A${ROW_TITLE}`).value = `${monthNum}월 ${header.programName} 참여자 급여대장`;
  sheet.getCell(`A${ROW_TITLE}`).font = {
    bold: true,
    size: 20,
    name: "맑은 고딕",
  };
  sheet.getCell(`A${ROW_TITLE}`).alignment = {
    horizontal: "center",
    vertical: "middle",
  };
  sheet.getRow(ROW_TITLE).height = 39.75;

  // 2. 월 소정근로시간 기준(만근 판정 기준) — 노인역량활용사업 근로계약서(첨부1)의 월 60시간을
  // 기본값으로 채우되, 사업단마다 다를 수 있어 직접 고칠 수 있는 입력 셀로 둔다. 비워두면
  // 근무일수 수식이 0으로 나눠 #DIV/0!이 된다.
  const MONTHLY_STANDARD_HOURS = 60;
  sheet.mergeCells(`A${ROW_SETTINGS}:E${ROW_SETTINGS}`);
  sheet.getCell(`A${ROW_SETTINGS}`).value = "※ 월 소정근로시간 기준(직접 입력) :";
  sheet.getCell(`A${ROW_SETTINGS}`).font = {
    bold: true,
    size: 10,
    name: "맑은 고딕",
  };
  sheet.getCell(`A${ROW_SETTINGS}`).alignment = {
    horizontal: "left",
    vertical: "middle",
  };
  const settingsCellRef = "F" + ROW_SETTINGS;
  sheet.getCell(settingsCellRef).value = MONTHLY_STANDARD_HOURS;
  sheet.getCell(settingsCellRef).border = {
    top: THIN,
    left: THIN,
    bottom: THIN,
    right: THIN,
  };
  sheet.getCell("G" + ROW_SETTINGS).value = "시간 (만근여부·근무일수 계산 기준)";
  sheet.getCell("G" + ROW_SETTINGS).font = {
    size: 9,
    italic: true,
    name: "맑은 고딕",
  };
  sheet.mergeCells(`G${ROW_SETTINGS}:${lastCol}${ROW_SETTINGS}`);
  sheet.getCell("G" + ROW_SETTINGS).alignment = {
    horizontal: "left",
    vertical: "middle",
  };
  sheet.getRow(ROW_SETTINGS).height = 20;

  // 3. 헤더 (2행: 그룹 라벨 + 세부 라벨)
  // groupStart: 이 열부터 시작하는 그룹의 span 크기(ROW_HEADER1을 가로로 병합).
  // inGroup: groupStart로 시작된 그룹에 속한 후속 열(ROW_HEADER1은 이미 병합돼있어 건드리지 않음).
  type ColDef = { label: string; groupStart?: number; inGroup?: boolean };
  const columns: ColDef[] = [
    { label: "연번" },
    { label: "성명" },
    { label: "생년월일" },
    { label: "은행" },
    { label: "계좌번호" },
    { label: "결근\n시간" },
    { label: "조퇴\n시간" },
    { label: "시간당\n단  가" },
    { label: "근무일수" },
    { label: "총\n근무시간" },
    { label: "근무시간", groupStart: 4 }, // K~N: 총근무시간 그룹
    { label: "연차\n사용시간", inGroup: true },
    { label: "교육시간", inGroup: true },
    { label: "공휴일\n유급시간", inGroup: true },
    { label: "만근여부" },
    { label: "기본급\n(a)" },
    { label: "건강보험", groupStart: 3 }, // Q~S: 사회보험(개인공제)
    { label: "장기요양\n보      험", inGroup: true },
    { label: "고용보험", inGroup: true },
    { label: "사회보험\n(개인공제)\n소  계(b)" },
    { label: "건강보험", groupStart: 4 }, // U~X: 사회보험(기관부담)
    { label: "장기요양\n보      험", inGroup: true },
    { label: "고용보험", inGroup: true },
    { label: "산재보험", inGroup: true },
    { label: "사회보험\n(기관부담)\n소     계" },
    { label: "인건비\n차감 소계\n(a-b)" },
    { label: "주휴\n시간", groupStart: 2 }, // AA~AB: 주휴수당
    { label: "주휴수당", inGroup: true },
    { label: "미사용\n시간", groupStart: 2 }, // AC~AD: 연차수당
    { label: "연차수당", inGroup: true },
    { label: "팀장수당" },
    { label: "부대경비\n소     계\n(c)" },
    { label: "총 지급액\n(a+c)" },
    { label: "실수령액\n(a-b+c)" },
    { label: "비고" },
  ];
  const groupLabels: Record<number, string> = {
    11: "총근무시간",
    17: "사회보험(개인공제)",
    21: "사회보험(기관부담)",
    27: "주휴수당",
    29: "연차수당",
  };

  let colIndex = 1;
  columns.forEach((col) => {
    const letter = colLetter(colIndex);
    if (col.groupStart) {
      const endLetter = colLetter(colIndex + col.groupStart - 1);
      sheet.mergeCells(`${letter}${ROW_HEADER1}:${endLetter}${ROW_HEADER1}`);
      sheet.getCell(`${letter}${ROW_HEADER1}`).value = groupLabels[colIndex];
      sheet.getCell(`${letter}${ROW_HEADER2}`).value = col.label;
    } else if (col.inGroup) {
      sheet.getCell(`${letter}${ROW_HEADER2}`).value = col.label;
    } else {
      sheet.mergeCells(`${letter}${ROW_HEADER1}:${letter}${ROW_HEADER2}`);
      sheet.getCell(`${letter}${ROW_HEADER1}`).value = col.label;
    }
    colIndex += 1;
  });
  sheet.getRow(ROW_HEADER1).height = 19.9;
  sheet.getRow(ROW_HEADER2).height = 30;
  [ROW_HEADER1, ROW_HEADER2].forEach((rowNumber) => {
    sheet.getRow(rowNumber).eachCell({ includeEmpty: true }, (cell) => {
      cell.font = { bold: true, size: 10, name: "맑은 고딕" };
      cell.alignment = CENTER;
      cell.fill = HEADER_FILL;
    });
  });

  // 4. 데이터 행
  sheet.getRow(ROW_TOTAL).height = 30;
  if (participants.length === 0) {
    sheet.mergeCells(`B${DATA_START}:${lastCol}${DATA_START}`);
    sheet.getCell(`B${DATA_START}`).value = "해당 월에 활동중인 참여자가 없습니다.";
    sheet.getCell(`B${DATA_START}`).alignment = CENTER;
    sheet.getRow(DATA_START).height = 30;
  }
  participants.forEach((participant, i) => {
    const row = DATA_START + i;
    sheet.getRow(row).height = 30;

    sheet.getCell(`A${row}`).value = i + 1;
    sheet.getCell(`B${row}`).value = participant.name;
    sheet.getCell(`H${row}`).value = participant.hourlyWage;
    // 근무일수 = 총근무시간 ÷ 1일 소정근로시간(= 월 소정근로시간 기준 ÷ 20일)
    sheet.getCell(`I${row}`).value = {
      formula: `J${row}*20/$F$${ROW_SETTINGS}`,
    };
    sheet.getCell(`J${row}`).value = { formula: `SUM(K${row}:N${row})` };
    sheet.getCell(`K${row}`).value = participant.actualWorkHours;
    sheet.getCell(`L${row}`).value = Math.round(participant.paidLeaveHours * 10) / 10;
    sheet.getCell(`M${row}`).value = Math.round(participant.trainingHours * 10) / 10;
    sheet.getCell(`N${row}`).value = participant.holidayPaidHours;
    // 만근(개근)은 실제 근무시간이 아니라 인정 근로시간으로 본다 — 소정근로일에 출근했다면
    // 지각·조퇴가 있어도 그날 전체를 인정한다(임금산정 기준 첨부1).
    sheet.getCell(`O${row}`).value = {
      formula: `IF(${participant.recognizedHours}>=$F$${ROW_SETTINGS},"O","X")`,
    };
    // 기본급은 실제로 일한 시간(유급 포함) × 단가 — 조퇴로 못 채운 시간까지 주지는 않는다.
    sheet.getCell(`P${row}`).value = { formula: `H${row}*J${row}` };
    // 4대보험은 기본급 + 주휴수당 기준 — 팀장수당·연차수당은 넣지 않는다.
    const insuranceBase = `(P${row}+AB${row})`;
    sheet.getCell(`Q${row}`).value = participant.healthInsuranceEnrolled
      ? { formula: `ROUND(${insuranceBase}*${header.healthInsuranceRate}/100,0)` }
      : 0;
    sheet.getCell(`R${row}`).value = participant.longtermCareInsuranceEnrolled
      ? { formula: `ROUND(Q${row}*${header.longtermCareRate}/100,0)` }
      : 0;
    sheet.getCell(`S${row}`).value = participant.employmentInsuranceEnrolled
      ? { formula: `ROUND(${insuranceBase}*${header.employmentInsuranceRate}/100,0)` }
      : 0;
    sheet.getCell(`T${row}`).value = { formula: `SUM(Q${row}:S${row})` };
    sheet.getCell(`U${row}`).value = { formula: `Q${row}` };
    sheet.getCell(`V${row}`).value = { formula: `R${row}` };
    sheet.getCell(`W${row}`).value = participant.employmentInsuranceEnrolled
      ? { formula: `ROUND(${insuranceBase}*${header.employmentInsuranceEmployerRate}/100,0)` }
      : 0;
    sheet.getCell(`X${row}`).value = participant.industrialAccidentInsuranceEnrolled
      ? { formula: `ROUND(${insuranceBase}*${header.industrialAccidentRate}/100,0)` }
      : 0;
    sheet.getCell(`Y${row}`).value = { formula: `SUM(U${row}:X${row})` };
    sheet.getCell(`Z${row}`).value = { formula: `P${row}-T${row}` };
    sheet.getCell(`AA${row}`).value = participant.weeklyHolidayHours;
    sheet.getCell(`AB${row}`).value = { formula: `H${row}*AA${row}` };
    sheet.getCell(`AC${row}`).value = Math.round(participant.remainingLeaveHours * 10) / 10;
    sheet.getCell(`AD${row}`).value = { formula: `H${row}*AC${row}` };
    sheet.getCell(`AE${row}`).value = participant.teamLeaderAllowance;
    sheet.getCell(`AF${row}`).value = { formula: `AB${row}+AD${row}+AE${row}` };
    sheet.getCell(`AG${row}`).value = { formula: `P${row}+AF${row}` };
    sheet.getCell(`AH${row}`).value = { formula: `AG${row}-T${row}` };
  });

  // 5. 합계 행
  const totalRange = (colLetterStr: string) =>
    `${colLetterStr}${DATA_START}:${colLetterStr}${dataEnd}`;
  [
    "F",
    "G",
    "I",
    "J",
    "K",
    "L",
    "M",
    "N",
    "P",
    "Q",
    "R",
    "S",
    "T",
    "U",
    "V",
    "W",
    "X",
    "Y",
    "Z",
    "AA",
    "AB",
    "AC",
    "AD",
    "AE",
    "AF",
    "AG",
    "AH",
  ].forEach((colLetterStr) => {
    sheet.getCell(`${colLetterStr}${ROW_TOTAL}`).value = {
      formula: `SUM(${totalRange(colLetterStr)})`,
    };
  });
  sheet.getCell(`B${ROW_TOTAL}`).value = "합계";
  sheet.getCell(`B${ROW_TOTAL}`).font = {
    bold: true,
    size: 10,
    name: "맑은 고딕",
  };

  // 6. 산정방법 안내
  sheet.mergeCells(`A${ROW_NOTES}:${lastCol}${ROW_NOTES}`);
  sheet.getCell(`A${ROW_NOTES}`).value =
    "[급여 산정방법]\n" +
    "* 총근무시간 = 근무시간 + 연차 사용시간 + 교육시간 + 평일 공휴일 유급시간(1일 3시간, 그 공휴일 당시 재직자) / 기본급(a) = 총근무시간 × 시간당 단가\n" +
    "* 만근여부·주휴시간은 인정 근로시간(소정근로일에 출근했으면 지각·조퇴와 상관없이 그날 전체 인정 + 유급시간)으로 판단합니다. 월 소정근로시간 기준(기본 60시간)은 고칠 수 있습니다.\n" +
    "* 주휴시간: 월 15시간 미만 0 / 15시간 이상 3 / 30시간 이상 6 / 45시간 이상 9 / 60시간(개근) 12시간 (주휴수당 = 주휴시간 × 시간당 단가)\n" +
    "* 연차: 월 60시간 개근 시 3시간(최대 30시간) 자동 적립, 미사용 연차수당은 계약 종료 달에만 정산합니다. 팀장수당은 별도 지급하며 4대보험 산정(기본급+주휴수당)에 넣지 않습니다.\n" +
    "* 결근·조퇴 시간, 은행·계좌번호, 생년월일은 데이터가 없어 직접 입력합니다. 월을 걸치는 주의 법정 주휴·월 중 퇴사자의 법정 연차는 자동 계산하지 않으니 해당자는 직접 고쳐주세요.";
  sheet.getCell(`A${ROW_NOTES}`).font = { size: 10, name: "맑은 고딕" };
  sheet.getCell(`A${ROW_NOTES}`).alignment = {
    horizontal: "left",
    vertical: "top",
    wrapText: true,
  };
  sheet.getRow(ROW_NOTES).height = 120;

  // 7. 테두리/서식/정렬 일괄 적용
  for (let rowNumber = ROW_HEADER1; rowNumber <= ROW_TOTAL; rowNumber++) {
    for (let c = 1; c <= COL_COUNT; c++) {
      const cell = sheet.getCell(`${colLetter(c)}${rowNumber}`);
      cell.border = {
        top: rowNumber === ROW_HEADER1 ? MEDIUM : THIN,
        bottom: rowNumber === ROW_TOTAL ? MEDIUM : THIN,
        left: LEFT_MEDIUM_COLS.has(c) ? MEDIUM : THIN,
        right: RIGHT_MEDIUM_COLS.has(c) ? MEDIUM : THIN,
      };
      if (rowNumber === ROW_TOTAL) {
        cell.fill = TOTAL_FILL;
        cell.font = { bold: true, size: 10, name: "맑은 고딕" };
      }
      if (!cell.alignment) cell.alignment = CENTER;
      if (rowNumber === ROW_TOTAL && (COMPUTED_COLS.has(c) || c === 31) && !cell.numFmt) {
        cell.numFmt = MONEY_FMT;
      }
    }
  }
  for (let rowNumber = DATA_START; rowNumber <= dataEnd; rowNumber++) {
    for (let c = 1; c <= COL_COUNT; c++) {
      const cell = sheet.getCell(`${colLetter(c)}${rowNumber}`);
      cell.border = {
        top: THIN,
        bottom: rowNumber === dataEnd ? MEDIUM : THIN,
        left: LEFT_MEDIUM_COLS.has(c) ? MEDIUM : THIN,
        right: RIGHT_MEDIUM_COLS.has(c) ? MEDIUM : THIN,
      };
      cell.font = { size: 10, name: "맑은 고딕" };
      if (!cell.alignment) cell.alignment = CENTER;
      if (COMPUTED_COLS.has(c)) {
        cell.fill = COMPUTED_FILL;
        cell.numFmt = MONEY_FMT;
      } else if (MONEY_INPUT_COLS.has(c)) {
        cell.numFmt = MONEY_FMT;
      }
    }
  }

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `급여대장_${header.month}.xlsx`;
  link.click();
  URL.revokeObjectURL(link.href);
};

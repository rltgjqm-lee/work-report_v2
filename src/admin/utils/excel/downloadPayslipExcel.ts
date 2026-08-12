import ExcelJS from "exceljs";

export interface PayslipHeader {
  organizationName: string;
  month: string; // "YYYY-MM"
  healthInsuranceRate: number; // %
  longtermCareRate: number; // % (건강보험료 대비 요율)
  employmentInsuranceRate: number; // %
}

export interface PayslipParticipant {
  name: string;
  actualWorkHours: number;
  hourlyWage: number;
  healthInsuranceEnrolled: boolean;
  longtermCareInsuranceEnrolled: boolean;
  employmentInsuranceEnrolled: boolean;
}

// 원본 서식(work-report-v4/서식(1)/역량활용/노인역량활용사업 급여명세서.xlsx)의 실측값을
// 그대로 따른다 — 라벨은 휴먼명조, 실제 채워지는 값은 맑은 고딕, 구획 헤더만 민트색(CFF1D1).
const LABEL_FONT = { size: 11, name: "휴먼명조" };
const LABEL_FONT_BOLD = { size: 11, bold: true, name: "휴먼명조" };
const TITLE_FONT = { size: 16, bold: true, name: "휴먼명조" };
const VALUE_FONT = { size: 11, name: "맑은 고딕" };
// color 없이 style만 주면 구글 시트가 xlsx를 가져올 때 테두리를 안 그리는 문제가 있어서
// 명시적으로 검정을 지정한다.
const THIN_BORDER = { style: "thin" as const, color: { argb: "FF000000" } };
const CENTER = { horizontal: "center" as const, vertical: "middle" as const };
const RIGHT = { horizontal: "right" as const, vertical: "middle" as const };
const LEFT = { horizontal: "left" as const, vertical: "middle" as const };
const WHITE_FILL: ExcelJS.Fill = {
  type: "pattern",
  pattern: "solid",
  fgColor: { argb: "FFFFFFFF" },
};
const SECTION_FILL: ExcelJS.Fill = {
  type: "pattern",
  pattern: "solid",
  fgColor: { argb: "FFCFF1D1" },
};
const MONEY_FMT = '_-* #,##0_-;-* #,##0_-;_-* "-"_-;_-@_-';
const COL_WIDTHS = [1.71, 13.14, 6.14, 4.86, 12.71, 2.29, 9.29, 9.57, 9.86, 4.57, 5.86, 2, 16.14];
const ROW_HEIGHTS: Record<number, number> = {
  1: 40.5,
  2: 18,
  3: 36,
  4: 27.4,
  5: 27.4,
  6: 26.65,
  7: 18,
  8: 27.4,
  9: 27.4,
  10: 27.4,
  11: 27.4,
  12: 27.4,
  13: 27.4,
  14: 27.4,
  15: 27.4,
  16: 27.4,
  17: 27.4,
  18: 27.4,
  19: 27.4,
  20: 18,
  21: 13.7,
  22: 13.7,
  23: 27.4,
  24: 18,
  25: 27.4,
  26: 27.4,
  27: 27.4,
  28: 27.4,
  29: 27.4,
  30: 27.4,
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

// 라벨 셀(휴먼명조, 흰 배경, 가운데 정렬)을 한 번에 세팅하는 헬퍼
const setLabel = (
  sheet: ExcelJS.Worksheet,
  ref: string,
  value: string,
  opts: {
    bold?: boolean;
    fill?: ExcelJS.Fill;
    align?: Partial<ExcelJS.Alignment>;
  } = {},
) => {
  const cell = sheet.getCell(ref);
  cell.value = value;
  cell.font = opts.bold ? LABEL_FONT_BOLD : LABEL_FONT;
  cell.fill = opts.fill ?? WHITE_FILL;
  cell.alignment = opts.align ?? CENTER;
};

const addPayslipSheet = (
  workbook: ExcelJS.Workbook,
  sheetName: string,
  header: PayslipHeader,
  participant: PayslipParticipant,
): void => {
  const sheet = workbook.addWorksheet(sheetName);
  const monthNum = Number(header.month.slice(5, 7));
  sheet.pageSetup = { paperSize: 9, orientation: "portrait", fitToPage: true };
  sheet.columns = COL_WIDTHS.map((width) => ({ width }));
  Object.entries(ROW_HEIGHTS).forEach(([row, height]) => {
    sheet.getRow(Number(row)).height = height;
  });

  // 1. 제목
  sheet.mergeCells("B2:M3");
  setLabel(sheet, "B2", `${monthNum}월 급 여 명 세 서`);
  sheet.getCell("B2").font = TITLE_FONT;

  // 2. 지급일 / 성명·소속 / 생년월일 (지급일·생년월일은 데이터가 없어 공란)
  sheet.mergeCells("B4:M4");
  setLabel(sheet, "B4", "지급일 :", { align: RIGHT });

  setLabel(sheet, "B5", "성명");
  sheet.mergeCells("C5:G5");
  sheet.getCell("C5").value = participant.name;
  sheet.getCell("C5").font = VALUE_FONT;
  sheet.getCell("C5").fill = WHITE_FILL;
  sheet.getCell("C5").alignment = { ...LEFT, wrapText: true };
  sheet.mergeCells("H5:I6");
  setLabel(sheet, "H5", "생년월일");
  sheet.mergeCells("J5:M6");
  sheet.getCell("J5").fill = WHITE_FILL;

  setLabel(sheet, "B6", "소속");
  sheet.mergeCells("C6:G6");
  sheet.getCell("C6").value = header.organizationName;
  sheet.getCell("C6").font = VALUE_FONT;
  sheet.getCell("C6").fill = WHITE_FILL;
  sheet.getCell("C6").alignment = { ...LEFT, wrapText: true };

  // 3. 세부 내역
  sheet.mergeCells("B8:M8");
  setLabel(sheet, "B8", "세부 내역", { bold: true, fill: SECTION_FILL });

  sheet.mergeCells("B9:G9");
  setLabel(sheet, "B9", "지    급", { bold: true });
  sheet.mergeCells("H9:M9");
  setLabel(sheet, "H9", "공    제", { bold: true });

  sheet.mergeCells("B10:D10");
  setLabel(sheet, "B10", "임금 항목", { bold: true });
  sheet.mergeCells("E10:G10");
  setLabel(sheet, "E10", "지급 금액 (원)", { bold: true });
  sheet.mergeCells("H10:J10");
  setLabel(sheet, "H10", "공제 항목", { bold: true });
  sheet.mergeCells("K10:M10");
  setLabel(sheet, "K10", "공제 금액 (원)", { bold: true });

  const setMoneyValue = (
    labelRange: string,
    valueRange: string,
    label: string,
    value: number | { formula: string } | null,
  ) => {
    sheet.mergeCells(labelRange);
    setLabel(sheet, labelRange.split(":")[0], label);
    sheet.mergeCells(valueRange);
    const valueCell = sheet.getCell(valueRange.split(":")[0]);
    if (value !== null) valueCell.value = value;
    valueCell.font = VALUE_FONT;
    valueCell.fill = WHITE_FILL;
    valueCell.alignment = RIGHT;
    valueCell.numFmt = MONEY_FMT;
  };

  // 지급 항목 — 기본급만 자동 계산(실제근무시간 × 시급), 나머지는 데이터가 없어 공란
  setMoneyValue("B11:D11", "E11:G11", "기본급", { formula: "B23*D23" });
  setMoneyValue("B12:D12", "E12:G12", "주휴수당", null);
  setMoneyValue("B13:D13", "E13:G13", "연차수당", null);
  setMoneyValue("B14:D14", "E14:G14", "기타수당", null);
  setMoneyValue("B15:D15", "E15:G15", "팀장수당", null);
  setMoneyValue("B16:D16", "E16:G16", "기관보조금(보수)", null);
  setMoneyValue("B17:D17", "E17:G17", "지급액(a)", { formula: "SUM(E11:E16)" });

  // 공제 항목 — 4대보험만 자동 계산, 나머지(소득세/지방세/기타공제)는 공란.
  // 건강보험 = 지급액(a) × 건강보험료율 / 장기요양보험 = 건강보험료 × 장기요양보험료율
  // (실무 관례대로 건강보험료에 대한 비율로 계산) / 고용보험 = 지급액(a) × 고용보험료율.
  // 산재보험은 전액 사업주 부담이라 근로자 명세서엔 0으로 고정.
  setMoneyValue(
    "H11:J11",
    "K11:M11",
    "건강보험",
    participant.healthInsuranceEnrolled
      ? { formula: `ROUND(E17*${header.healthInsuranceRate}/100,0)` }
      : 0,
  );
  setMoneyValue(
    "H12:J12",
    "K12:M12",
    "장기요양보험",
    participant.longtermCareInsuranceEnrolled
      ? { formula: `ROUND(K11*${header.longtermCareRate}/100,0)` }
      : 0,
  );
  setMoneyValue(
    "H13:J13",
    "K13:M13",
    "고용보험",
    participant.employmentInsuranceEnrolled
      ? { formula: `ROUND(E17*${header.employmentInsuranceRate}/100,0)` }
      : 0,
  );
  setMoneyValue("H14:J14", "K14:M14", "산재보험", 0);
  setMoneyValue("H15:J15", "K15:M15", "소득세", null);
  setMoneyValue("H16:J16", "K16:M16", "지방세", null);
  setMoneyValue("H17:J17", "K17:M17", "기타 공제액", null);
  setMoneyValue("H18:J18", "K18:M18", "공제액(b)", { formula: "SUM(K11:K17)" });
  setMoneyValue("H19:J19", "K19:M19", "실수령액(a-b)", { formula: "E17-K18" });

  // 지급액(a) 아래는 항목이 없어 빈 칸이지만, 공제 쪽과 칸 구획을 맞추기 위해 병합해둔다.
  sheet.mergeCells("B18:D18");
  sheet.mergeCells("E18:G18");
  sheet.mergeCells("B19:D19");
  sheet.mergeCells("E19:G19");
  ["B18", "E18", "B19", "E19"].forEach((ref) => {
    sheet.getCell(ref).fill = WHITE_FILL;
  });

  // 4. 시급 / 근무시간 요약 (기본급 계산의 근거 셀) — 원본과 같은 2행 헤더 + 값 1행
  sheet.mergeCells("B21:C22");
  setLabel(sheet, "B21", "시급 (원)", { bold: true, fill: SECTION_FILL });
  sheet.mergeCells("D21:H21");
  setLabel(sheet, "D21", "총 근무시간", { bold: true, fill: SECTION_FILL });
  sheet.mergeCells("D22:F22");
  setLabel(sheet, "D22", "실제근무시간", { bold: true, fill: SECTION_FILL });
  sheet.mergeCells("G22:H22");
  setLabel(sheet, "G22", "연차사용시간", { bold: true, fill: SECTION_FILL });
  sheet.mergeCells("I21:K22");
  setLabel(sheet, "I21", "주휴시간", { bold: true, fill: SECTION_FILL });
  sheet.mergeCells("L21:M22");
  setLabel(sheet, "L21", "기타근무시간", { bold: true, fill: SECTION_FILL });

  sheet.mergeCells("B23:C23");
  sheet.getCell("B23").value = participant.hourlyWage;
  sheet.mergeCells("D23:F23");
  sheet.getCell("D23").value = participant.actualWorkHours;
  sheet.mergeCells("G23:H23");
  sheet.mergeCells("I23:K23");
  sheet.mergeCells("L23:M23");
  ["B23", "D23", "G23", "I23", "L23"].forEach((ref) => {
    const cell = sheet.getCell(ref);
    cell.font = VALUE_FONT;
    cell.fill = WHITE_FILL;
    cell.alignment = CENTER;
  });

  // 5. 산출식 안내
  sheet.mergeCells("B25:M25");
  setLabel(sheet, "B25", "산출식 또는 산출방법", {
    bold: true,
    fill: SECTION_FILL,
  });

  const guideRows: [string, string][] = [
    ["기본급", "실제근무시간 × 시급"],
    ["주휴수당", "(수기 입력 — 주 단위 근무시간 기준 산정 필요)"],
    ["연차수당", "(수기 입력 — 미사용연차시간 기준 산정 필요)"],
    ["기타수당", "(수기 입력 — 초과근무시간 기준 산정 필요)"],
    ["팀장수당", "근로계약서 제6조 제1항에 따른 월 정액"],
    ["건강보험", `지급액(a) × 건강보험료율(${header.healthInsuranceRate}%)`],
    ["장기요양보험", `건강보험료 × 장기요양보험료율(${header.longtermCareRate}%)`],
    ["고용보험", `지급액(a) × 고용보험료율(${header.employmentInsuranceRate}%)`],
  ];
  guideRows.forEach(([label, desc], index) => {
    const row = 26 + index;
    // ROW_HEIGHTS는 30행까지만 정의돼있어서, 항목이 늘어나 30행을 넘어가면
    // 여기서 매번 명시적으로 높이를 맞춰줘야 다른 수당 행들과 높이가 안 어긋난다.
    sheet.getRow(row).height = ROW_HEIGHTS[26];
    sheet.mergeCells(`B${row}:C${row}`);
    setLabel(sheet, `B${row}`, label);
    sheet.mergeCells(`D${row}:M${row}`);
    setLabel(sheet, `D${row}`, desc);
  });

  const lastRow = 25 + guideRows.length;
  for (let rowNumber = 2; rowNumber <= lastRow; rowNumber++) {
    sheet.getRow(rowNumber).eachCell({ includeEmpty: true }, (cell, colNumber) => {
      if (!cell.fill || cell.fill.type !== "pattern") cell.fill = WHITE_FILL;
      // A열(3행 이후)은 얇은 여백 칸이라 가로 테두리(위/아래)는 빼고 세로 테두리만 남긴다.
      cell.border =
        colNumber === 1 && rowNumber >= 3
          ? { left: THIN_BORDER, right: THIN_BORDER }
          : {
              top: THIN_BORDER,
              left: THIN_BORDER,
              bottom: THIN_BORDER,
              right: THIN_BORDER,
            };
    });
  }

  // 지급일 줄(4행)은 제목과 바로 이어 붙게 경계선을 뺀다 — 제목 병합칸(B2:M3)의
  // 실제 아래쪽 테두리는 3행 셀들이 들고 있어서, 3행 bottom과 4행 top을 둘 다 지워야 한다.
  sheet.getRow(3).eachCell({ includeEmpty: true }, (cell) => {
    cell.border = { ...cell.border, bottom: undefined };
  });
  sheet.getRow(4).eachCell({ includeEmpty: true }, (cell) => {
    cell.border = { ...cell.border, top: undefined };
  });

  // 장기요양보험/고용보험 행 높이를 기본급 행과 명시적으로 맞춘다.
  sheet.getRow(12).height = sheet.getRow(11).height;
  sheet.getRow(13).height = sheet.getRow(11).height;
};

/**
 * 💡 사업단 1개월치 급여 명세서를 참여자별 시트로 만들어 다운로드합니다.
 * 4대보험(건강/장기요양/고용)만 자동 계산하고, 데이터가 없는 항목(주휴수당/연차수당/
 * 기타수당/팀장수당/소득세/지방세/생년월일/지급일/기관보조금/산재보험)은 공란으로 둔다.
 */
export const downloadPayslipWorkbook = async (
  header: PayslipHeader,
  participants: PayslipParticipant[],
): Promise<void> => {
  const workbook = new ExcelJS.Workbook();
  const usedSheetNames = new Set<string>();

  participants.forEach((participant) => {
    addPayslipSheet(
      workbook,
      sanitizeSheetName(participant.name, usedSheetNames),
      header,
      participant,
    );
  });

  if (participants.length === 0) {
    workbook.addWorksheet("급여명세서");
  }

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `급여명세서_${header.month}.xlsx`;
  link.click();
  URL.revokeObjectURL(link.href);
};

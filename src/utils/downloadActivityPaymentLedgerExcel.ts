import ExcelJS from "exceljs";

export interface ActivityPaymentLedgerHeader {
  programName: string;
  organizationName: string;
  month: string; // "YYYY-MM"
  hourlyWage: number;
}

export interface ActivityPaymentLedgerParticipant {
  name: string;
  demandName: string | null;
  minutes: number;
}

// color를 안 주면 스펙상 automatic(보통 검정)이지만, 구글 시트는 xlsx를 가져올 때
// color가 없는 테두리를 안 그리는 경우가 있어서 명시적으로 검정을 지정한다.
const THIN_BORDER = { style: "thin" as const, color: { argb: "FF000000" } };
const HEADER_FILL: ExcelJS.Fill = {
  type: "pattern",
  pattern: "solid",
  fgColor: { argb: "FFF2F2F2" },
};
// 서식 원본의 소계 행 배경(테마 accent5, tint 0.4)을 실제 RGB로 환산한 값
const SUBTOTAL_FILL: ExcelJS.Fill = {
  type: "pattern",
  pattern: "solid",
  fgColor: { argb: "FF93CDDD" },
};
const DATA_ROW_HEIGHT = 18.95;

/**
 * 💡 사업단 1개월치 활동비 지급 대장을 병합 셀 서식으로 시트 1개에 채웁니다.
 * 열 구성: 사업단/순번/수요처/참여자/생년월일/월활동시간/교육/치매검진/실지급액/은행/계좌번호/비고.
 * (주민번호, 월활동비, 시간당활동비는 서식에 없는 열이라 만들지 않는다)
 * 생년월일/은행/계좌번호/비고/교육/치매검진은 담당자가 수기로 채우도록 빈 칸으로 둔다
 * (교육/치매검진은 추후 정산 페이지에서 입력하는 값이라 지금은 계산하지 않는다).
 */
export const addActivityPaymentLedgerSheet = (
  workbook: ExcelJS.Workbook,
  sheetName: string,
  header: ActivityPaymentLedgerHeader,
  participants: ActivityPaymentLedgerParticipant[],
): void => {
  const sheet = workbook.addWorksheet(sheetName);
  const monthNum = Number(header.month.slice(5, 7));

  sheet.columns = [
    { width: 6.6 }, // A 사업단
    { width: 6.75 }, // B 순번
    { width: 23.5 }, // C 수요처
    { width: 11.25 }, // D 참여자
    { width: 14 }, // E 생년월일
    { width: 12.25 }, // F 월활동시간
    { width: 7.1 }, // G 교육
    { width: 9.75 }, // H 치매검진
    { width: 12.4 }, // I 실지급액
    { width: 15.75 }, // J 은행
    { width: 22 }, // K 계좌번호
    { width: 47.1 }, // L 비고
  ];

  // 1. 제목
  sheet.mergeCells("A1:L1");
  sheet.getCell("A1").value = `${header.programName} ${monthNum}월 활동비 지급내역`;
  sheet.getCell("A1").font = { size: 18, bold: true, name: "맑은 고딕" };
  sheet.getCell("A1").alignment = { horizontal: "center", vertical: "middle" };
  sheet.getRow(1).height = 29.25;

  // 2. 헤더
  const headerLabels = [
    "사업단",
    "순번",
    "수요처",
    "참여자",
    "생년월일",
    "월활동 \n시간",
    "교육",
    "치매검진",
    "실지급액",
    "은행",
    "계좌번호",
    "비고",
  ];
  const headerRow = sheet.getRow(2);
  headerRow.values = headerLabels;
  headerRow.height = 33.75;
  headerRow.eachCell((cell) => {
    cell.font = { bold: true, size: 11, name: "맑은 고딕" };
    cell.alignment = {
      horizontal: "center",
      vertical: "middle",
      wrapText: true,
    };
    cell.fill = HEADER_FILL;
    cell.border = {
      top: { style: "medium", color: { argb: "FF000000" } },
      bottom: { style: "medium", color: { argb: "FF000000" } },
      left: THIN_BORDER,
      right: THIN_BORDER,
    };
  });

  // 3. 데이터 행
  const startRow = 3;
  const lastRow = startRow + Math.max(participants.length, 1) - 1;

  if (participants.length === 0) {
    sheet.mergeCells(`B${startRow}:L${startRow}`);
    sheet.getCell(`B${startRow}`).value = "해당 월에 활동 기록이 있는 참여자가 없습니다.";
    sheet.getCell(`B${startRow}`).alignment = {
      horizontal: "center",
      vertical: "middle",
    };
  } else {
    let groupStartRow = startRow;
    participants.forEach((participant, index) => {
      const row = startRow + index;
      const hours = Math.round((participant.minutes / 60) * 10) / 10;

      sheet.getRow(row).height = DATA_ROW_HEIGHT;
      sheet.getCell(`B${row}`).value = index + 1;
      sheet.getCell(`D${row}`).value = participant.name;
      sheet.getCell(`F${row}`).value = hours;
      // 실지급액 = 시급 × 월활동시간 + 교육(G) + 치매검진(H) — 교육/치매검진은
      // 정산 페이지에서 나중에 채워질 빈 칸이라 수식으로 걸어두면 자동 반영된다.
      sheet.getCell(`I${row}`).value = {
        formula: `ROUND(${header.hourlyWage}*F${row},0)+G${row}+H${row}`,
      };
      sheet.getCell(`I${row}`).numFmt = '_-* #,##0_-;-* #,##0_-;_-* "-"_-;_-@_-';

      sheet.getRow(row).eachCell({ includeEmpty: true }, (cell, colNumber) => {
        if (colNumber === 1) return; // A는 사업단 병합 셀이라 별도 처리
        cell.font = cell.font ?? { size: 11, name: "맑은 고딕" };
        cell.alignment = cell.alignment ?? {
          horizontal: "center",
          vertical: "middle",
        };
        cell.border = {
          top: THIN_BORDER,
          bottom: THIN_BORDER,
          left: THIN_BORDER,
          right: THIN_BORDER,
        };
      });

      // 수요처 그룹(연속 동일값)이 끝나는 지점에서 병합
      const nextDemandName = participants[index + 1]?.demandName ?? null;
      if (nextDemandName !== participant.demandName) {
        if (row > groupStartRow) {
          sheet.mergeCells(`C${groupStartRow}:C${row}`);
        }
        sheet.getCell(`C${groupStartRow}`).value = participant.demandName ?? "-";
        sheet.getCell(`C${groupStartRow}`).alignment = {
          horizontal: "center",
          vertical: "middle",
          wrapText: true,
        };
        groupStartRow = row + 1;
      }
    });
  }

  // 4. 사업단명 세로 텍스트 (A열, 데이터 영역 전체 병합)
  sheet.mergeCells(`A${startRow}:A${lastRow}`);
  sheet.getCell(`A${startRow}`).value = header.programName.split("").join("\n");
  sheet.getCell(`A${startRow}`).font = {
    bold: true,
    size: 16,
    name: "맑은 고딕",
  };
  sheet.getCell(`A${startRow}`).alignment = {
    horizontal: "center",
    vertical: "middle",
    wrapText: true,
  };

  // 5. 소계
  const subtotalRow = lastRow + 1;
  sheet.getRow(subtotalRow).height = 23.25;
  sheet.mergeCells(`A${subtotalRow}:H${subtotalRow}`);
  sheet.getCell(`A${subtotalRow}`).value = "소계";
  sheet.mergeCells(`J${subtotalRow}:K${subtotalRow}`);
  sheet.getCell(`I${subtotalRow}`).value = {
    formula: `SUM(I${startRow}:I${lastRow})`,
  };
  sheet.getCell(`I${subtotalRow}`).numFmt = '_-* #,##0_-;-* #,##0_-;_-* "-"_-;_-@_-';
  sheet.getRow(subtotalRow).eachCell({ includeEmpty: true }, (cell, colNumber) => {
    if (colNumber > 11) return; // L(비고)는 소계 서식 밖
    cell.font = { bold: true, size: 11, name: "맑은 고딕" };
    cell.alignment = { horizontal: "center", vertical: "middle" };
    cell.fill = SUBTOTAL_FILL;
    cell.border = {
      top: { style: "medium", color: { argb: "FF000000" } },
      bottom: { style: "medium", color: { argb: "FF000000" } },
    };
  });

  // 6. 기관명
  const footerRow = subtotalRow + 1;
  sheet.mergeCells(`A${footerRow}:L${footerRow}`);
  sheet.getCell(`A${footerRow}`).value = header.organizationName;
  sheet.getCell(`A${footerRow}`).font = {
    bold: true,
    size: 18,
    name: "맑은 고딕",
  };
  sheet.getCell(`A${footerRow}`).alignment = {
    horizontal: "center",
    vertical: "middle",
  };
  sheet.getCell(`A${footerRow}`).border = {
    top: { style: "medium", color: { argb: "FF000000" } },
  };
  sheet.getRow(footerRow).height = 26.25;

  sheet.pageSetup = {
    fitToPage: true,
    fitToWidth: 1,
    fitToHeight: 1,
    orientation: "landscape",
    horizontalCentered: true,
  };
};

/**
 * 💡 활동비 지급 대장을 만들어 바로 다운로드합니다.
 */
export const buildActivityPaymentLedgerWorkbook = async (
  header: ActivityPaymentLedgerHeader,
  participants: ActivityPaymentLedgerParticipant[],
): Promise<ArrayBuffer> => {
  const workbook = new ExcelJS.Workbook();
  addActivityPaymentLedgerSheet(workbook, "활동비지급대장", header, participants);
  return workbook.xlsx.writeBuffer();
};

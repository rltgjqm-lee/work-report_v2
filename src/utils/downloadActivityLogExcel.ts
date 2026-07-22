import ExcelJS from "exceljs";
import type { ActivityLogFormData, ActivityLogItem } from "../types/form";

interface ExportExcelArgs {
  filteredLogs: ActivityLogItem[];
  formData: ActivityLogFormData;
  fileName: string;
}

export interface ActivityLogSheetHeader {
  orgName: string;
  programName: string;
  participantName: string;
  demandName: string;
}

/**
 * 💡 참여자 1인의 활동 일지 데이터를 워크북에 국문 서식의 시트 1개로 추가합니다.
 * 관리자 콘솔의 사업단 단위 일괄 출력(참여자별 시트)과 참여자 개인 다운로드에서 함께 씁니다.
 */
export const addActivityLogSheet = (
  workbook: ExcelJS.Workbook,
  sheetName: string,
  header: ActivityLogSheetHeader,
  logs: ActivityLogItem[],
): void => {
  const sheet = workbook.addWorksheet(sheetName);

  // 1. 제목 셀 설정 및 병합
  sheet.mergeCells("A1:J1");
  sheet.getCell("A1").value =
    "노인일자리 및 사회활동 지원사업 공익활동 활동일지(예시)";
  sheet.getCell("A1").alignment = { horizontal: "center", vertical: "middle" };
  sheet.getCell("A1").font = { size: 16, bold: true, underline: true };
  sheet.getRow(1).height = 40;

  // 2. 상단 기본 정보 영역 서식 정의
  sheet.mergeCells("B2:E2");
  sheet.mergeCells("G2:J2");
  sheet.mergeCells("B3:E3");
  sheet.mergeCells("G3:J3");

  sheet.getCell("A2").value = "기관명";
  sheet.getCell("B2").value = header.orgName;
  sheet.getCell("F2").value = "참여사업명";
  sheet.getCell("G2").value = header.programName;

  sheet.getCell("A3").value = "참여자 성명";
  sheet.getCell("B3").value = header.participantName;
  sheet.getCell("F3").value = "수요처명(서비스대상자명)";
  sheet.getCell("G3").value = header.demandName;

  // 3. 테이블 헤더 서식 및 텍스트 바인딩
  sheet.mergeCells("A4:A5");
  sheet.getCell("A4").value = "연번";
  sheet.mergeCells("B4:B5");
  sheet.getCell("B4").value = "활동일";

  sheet.mergeCells("C4:E4");
  sheet.getCell("C4").value = "활동시간";
  sheet.getCell("C5").value = "시작(00:00)";
  sheet.getCell("D5").value = "종료(00:00)";
  sheet.getCell("E5").value = "총시간";

  sheet.mergeCells("F4:F5");
  sheet.getCell("F4").value = "활동내용";
  sheet.mergeCells("G4:G5");
  sheet.getCell("G4").value = "활동장소";
  sheet.mergeCells("H4:H5");
  sheet.getCell("H4").value = "안전사고 발생유무\n(사고내용, 조치내용)";
  sheet.mergeCells("I4:I5");
  sheet.getCell("I4").value = "참여자\n서명";
  sheet.mergeCells("J4:J5");
  sheet.getCell("J4").value = "확인자(수요처)\n서명";

  // 4. 헤더 셀 테두리 및 정렬 스타일 적용
  for (let i = 2; i <= 5; i++) {
    sheet.getRow(i).alignment = {
      horizontal: "center",
      vertical: "middle",
      wrapText: true,
    };
    sheet.getRow(i).eachCell((cell) => {
      cell.border = {
        top: { style: "thin" },
        left: { style: "thin" },
        bottom: { style: "thin" },
        right: { style: "thin" },
      };
    });
  }

  // 5. 헤더 영역 배경색 및 볼드 처리
  const headerCells = [
    "A2",
    "F2",
    "A3",
    "F3",
    "A4",
    "B4",
    "C4",
    "F4",
    "G4",
    "H4",
    "I4",
    "J4",
    "C5",
    "D5",
    "E5",
  ];
  headerCells.forEach((ref) => {
    sheet.getCell(ref).fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FFF0F0F0" },
    };
    sheet.getCell(ref).font = { bold: true };
  });

  // 6. 열 너비 지정
  sheet.columns = [
    { width: 5 },
    { width: 12 },
    { width: 10 },
    { width: 10 },
    { width: 10 },
    { width: 25 },
    { width: 15 },
    { width: 20 },
    { width: 12 },
    { width: 12 },
  ];

  // 7. 데이터 행 순회 삽입 및 서명 이미지 렌더링
  const startRow = 6;

  // 원본을 변형하지 않기 위해 복사본을 정렬하여 루프를 돕니다.
  const sortedLogs = [...logs].sort((a, b) => a.timestamp - b.timestamp);

  if (sortedLogs.length === 0) {
    sheet.mergeCells(`A${startRow}:J${startRow}`);
    sheet.getCell(`A${startRow}`).value = "해당 기간에 등록된 활동일지가 없습니다.";
    sheet.getCell(`A${startRow}`).alignment = {
      horizontal: "center",
      vertical: "middle",
    };
    sheet.getCell(`A${startRow}`).font = { italic: true, color: { argb: "FF888888" } };
  }

  sortedLogs.forEach((log, index) => {
    let accidentText: string = log.accident;
    if (log.accident === "유") {
      accidentText += `\n(${log.accidentDetail} / ${log.accidentAction})`;
    }

    const currentRow = startRow + index;
    const row = sheet.getRow(currentRow);
    row.height = 40;
    row.values = [
      index + 1,
      log.date,
      log.start,
      log.end,
      log.totalTime,
      log.content,
      log.place,
      accidentText,
      "",
      "",
    ];

    row.alignment = {
      horizontal: "center",
      vertical: "middle",
      wrapText: true,
    };
    row.eachCell((cell) => {
      cell.border = {
        top: { style: "thin" },
        left: { style: "thin" },
        bottom: { style: "thin" },
        right: { style: "thin" },
      };
    });

    // 참여자 서명 삽입
    if (log.uSign) {
      try {
        const base64Data = log.uSign.split(",")[1];
        const imageId = workbook.addImage({
          base64: base64Data,
          extension: "png",
        });
        sheet.addImage(imageId, {
          tl: { col: 8, row: currentRow - 1 },
          ext: { width: 45, height: 25 },
        });
      } catch (error) {
        console.error("참여자 서명 이미지 내보내기 실패:", error);
      }
    }

    // 확인자(수요처) 서명 삽입
    if (log.dSign) {
      try {
        const base64Data = log.dSign.split(",")[1];
        const imageId = workbook.addImage({
          base64: base64Data,
          extension: "png",
        });
        sheet.addImage(imageId, {
          tl: { col: 9, row: currentRow - 1 },
          ext: { width: 45, height: 25 },
        });
      } catch (error) {
        console.error("수요처 서명 이미지 내보내기 실패:", error);
      }
    }
  });

  // 8. 하단 확인 문구 (서식 원본에 있는 부정수급 동의 문구)
  const noteRow = startRow + sortedLogs.length + 1;
  sheet.mergeCells(`A${noteRow}:J${noteRow}`);
  sheet.getCell(`A${noteRow}`).value =
    "※ 활동 내역이 사실과 틀림없음을 확인하였으며, 추후 보조금 부정수급으로 인한 제재 등의 조치에 동의합니다.";
  sheet.getCell(`A${noteRow}`).font = { size: 9 };
  sheet.getCell(`A${noteRow}`).alignment = {
    horizontal: "left",
    vertical: "middle",
  };
};

/**
 * 💡 활동 일지 데이터를 바탕으로 국문 서식의 ExcelJS 보고서를 생성하고 다운로드합니다.
 */
export const downloadActivityLogExcel = async ({
  filteredLogs,
  formData,
  fileName,
}: ExportExcelArgs): Promise<void> => {
  const workbook = new ExcelJS.Workbook();
  addActivityLogSheet(
    workbook,
    "공익활동일지",
    {
      orgName: formData.orgName,
      programName: formData.programName,
      participantName: formData.userName,
      demandName: formData.demandName,
    },
    filteredLogs,
  );

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(link.href); // 메모리 누수 방지용 해제 추가
};

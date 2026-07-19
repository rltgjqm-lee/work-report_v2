import type { Style, Cell } from "exceljs";

export async function downloadAddParticipantsTemplate(
  groups: { name: string }[] = [],
): Promise<void> {
  // 1. 번들 용량 절약을 위한 동적 로딩
  const ExcelJS = (await import("exceljs")).default;

  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet("데이터 입력");
  const groupNames = groups.map((group) => group.name);

  // 2. 1행, 2행 상단 고정
  worksheet.views = [{ state: "frozen", ySplit: 2, activeCell: "A3" }];

  // 3. 헤더 스타일 정의 (#14283d 배경, #e6ebf2 글씨)
  const headerStyle: Partial<Style> = {
    font: {
      name: "맑은 고딕",
      size: 11,
      bold: true,
      color: { argb: "FFE6EBF2" },
    },
    fill: { type: "pattern", pattern: "solid", fgColor: { argb: "FF14283D" } },
    alignment: { horizontal: "center", vertical: "middle" },
    border: {
      top: { style: "thin", color: { argb: "FFCCCCCC" } },
      bottom: { style: "thin", color: { argb: "FFCCCCCC" } },
    },
  };

  // 4. 1행 헤더 입력 (A1 ~ E1)
  const headerRow = worksheet.addRow([
    "순번",
    "이름",
    "수요처명",
    "전화번호 뒷자리 (4자리)",
    "조",
  ]);
  headerRow.height = 25;
  headerRow.eachCell((cell: Cell) => {
    cell.style = headerStyle as Style;
  });

  // 5. 2행 주의사항 입력 (요청하신 줄바꿈 적용 및 높이 조절)
  const noticeText =
    "⚠️ 주의사항:\n• 헤더는 수정하지 마세요.\n• [순번]은 숫자만, [전화번호]는 앞의 0이 지워지지 않도록 4자리 숫자를 문자 형태로 입력해 주세요.";
  const noticeRow = worksheet.addRow([noticeText]);
  noticeRow.height = 65; // 💡 줄바꿈 텍스트가 잘리지 않도록 행 높이를 65로 대폭 확장
  worksheet.mergeCells("A2:E2");

  noticeRow.getCell(1).style = {
    font: {
      name: "맑은 고딕",
      size: 10,
      color: { argb: "FFD9383A" },
      bold: true,
    },
    fill: { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFF2CC" } },
    alignment: { vertical: "middle", wrapText: true }, // 💡 wrapText: true 설정으로 텍스트 자동 줄바꿈 활성화
  } as Style;

  // 6. 데이터 영역 컬럼 기본 서식 및 너비 정의
  worksheet.columns = [
    { key: "num", width: 12, numFmt: "#,##0" },
    { key: "name", width: 18, numFmt: "@" },
    { key: "client", width: 28, numFmt: "@" },
    { key: "phone", width: 28, numFmt: "@" }, // 기본 텍스트 서식 지정
    { key: "group", width: 18, numFmt: "@" },
  ];

  // 6-1. 조 목록을 숨김 시트에 적어두고 E열 드롭다운 검증에서 참조한다
  let groupListRange: string | null = null;
  if (groupNames.length > 0) {
    const groupListSheet = workbook.addWorksheet("조목록");
    groupNames.forEach((name, index) => {
      groupListSheet.getCell(index + 1, 1).value = name;
    });
    groupListSheet.state = "veryHidden";
    groupListRange = `조목록!$A$1:$A$${groupNames.length}`;
  }

  // 7. 데이터 입력 영역 생성 (3행부터 502행까지 잠금 해제)
  for (let i = 1; i <= 500; i++) {
    // 💡 번호 깨짐 방지: 전화번호를 입력할 빈 셀의 서식을 처음부터 강제로 '텍스트(@)'로 주입합니다.
    const row = worksheet.addRow({
      num: i,
      name: "",
      client: "",
      phone: "",
      group: "",
    });

    row.eachCell((cell: Cell, colNumber: number) => {
      cell.protection = { locked: false }; // 데이터 입력 구역 잠금 해제

      cell.font = { name: "맑은 고딕", size: 11 };
      cell.border = {
        bottom: { style: "thin", color: { argb: "FFE0E0E0" } },
        right: { style: "thin", color: { argb: "FFE0E0E0" } },
      };

      // 💡 컬럼 서식 강제화 (특히 D열 전화번호 뒷자리에 강제 텍스트 서식 `@` 주입)
      if (colNumber === 4) {
        cell.numFmt = "@";
        cell.alignment = { horizontal: "center" };
      } else if (colNumber === 1) {
        cell.alignment = { horizontal: "center" };
      } else {
        cell.numFmt = "@"; // 이름과 수요처명도 텍스트 서식으로 안전하게 지정
      }
    });

    // 💡 E열(조)은 등록된 조 이름 중에서만 고르도록 드롭다운 검증을 건다 (미입력 시 미배정)
    if (groupListRange) {
      row.getCell(5).dataValidation = {
        type: "list",
        allowBlank: true,
        formulae: [groupListRange],
        showErrorMessage: true,
        errorTitle: "잘못된 조 이름",
        error: "목록에 있는 조 이름만 선택할 수 있어요.",
      };
    }
  }

  // 8. 시트 보호 활성화
  worksheet.protect("", {
    selectLockedCells: true,
    selectUnlockedCells: true,
    formatCells: false,
    insertRows: false,
    deleteRows: false,
  });

  // 9. 엑셀 파일 브라우저 다운로드 실행
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = "참여자_추가_입력_양식.xlsx";
  link.click();
  URL.revokeObjectURL(link.href);
}

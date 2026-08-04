import type { Style, Cell } from "exceljs";

export async function downloadAddParticipantsTemplate(
  groups: { name: string }[] = [],
  demandSites: { name: string }[] = [],
): Promise<void> {
  // 1. 번들 용량 절약을 위한 동적 로딩
  const ExcelJS = (await import("exceljs")).default;

  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet("데이터 입력");
  const groupNames = groups.map((group) => group.name);
  const demandSiteNames = demandSites.map((demandSite) => demandSite.name);

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
    "수요처(필수·목록선택)",
    "조",
    "성별(필수·목록선택)",
  ]);
  headerRow.height = 25;
  headerRow.eachCell((cell: Cell) => {
    cell.style = headerStyle as Style;
  });

  // 5. 2행 주의사항 입력 (요청하신 줄바꿈 적용 및 높이 조절)
  const noticeText =
    "⚠️ 주의사항:\n• 헤더는 수정하지 마세요.\n• [순번]은 숫자만 입력해 주세요.\n• 동명이인이 있으면 이름 뒤에 숫자를 붙여 구분해주세요\n  (예: 홍길동1, 홍길동2).\n• [수요처]는 필수입니다 — 비어있으면 등록되지 않아요.\n• [성별]은 필수입니다 — 비어있으면 등록되지 않아요.";
  const noticeRow = worksheet.addRow([noticeText]);
  noticeRow.height = 105; // 💡 줄바꿈 텍스트가 잘리지 않도록 행 높이를 확장(수요처 필수 안내 한 줄 추가)
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
    { key: "demandSite", width: 22, numFmt: "@" },
    { key: "group", width: 18, numFmt: "@" },
    { key: "gender", width: 14, numFmt: "@" },
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

  // 6-2. 수요처 목록을 숨김 시트에 적어두고 D열 드롭다운 검증에서 참조한다
  let demandSiteListRange: string | null = null;
  if (demandSiteNames.length > 0) {
    const demandSiteListSheet = workbook.addWorksheet("수요처목록");
    demandSiteNames.forEach((name, index) => {
      demandSiteListSheet.getCell(index + 1, 1).value = name;
    });
    demandSiteListSheet.state = "veryHidden";
    demandSiteListRange = `수요처목록!$A$1:$A$${demandSiteNames.length}`;
  }

  // 7. 데이터 입력 영역 생성 (3행부터 502행까지 잠금 해제)
  for (let i = 1; i <= 500; i++) {
    const row = worksheet.addRow({
      num: i,
      name: "",
      demandSite: "",
      group: "",
      gender: "",
    });

    row.eachCell((cell: Cell, colNumber: number) => {
      cell.protection = { locked: false }; // 데이터 입력 구역 잠금 해제

      cell.font = { name: "맑은 고딕", size: 11 };
      cell.border = {
        bottom: { style: "thin", color: { argb: "FFE0E0E0" } },
        right: { style: "thin", color: { argb: "FFE0E0E0" } },
      };

      if (colNumber === 1) {
        cell.alignment = { horizontal: "center" };
      } else {
        cell.numFmt = "@"; // 이름/수요처/조도 텍스트 서식으로 안전하게 지정
      }
    });

    // 💡 C열(수요처)은 등록된 수요처 이름 중에서만 고르도록 드롭다운 검증을 건다.
    // 필수 항목이라 allowBlank: false로 둔다 — 성별과 동일하게, 실제 필수 검증은
    // 업로드 시 parseParticipantsFile/서버에서 한다.
    if (demandSiteListRange) {
      row.getCell(3).dataValidation = {
        type: "list",
        allowBlank: false,
        formulae: [demandSiteListRange],
        showErrorMessage: true,
        errorTitle: "잘못된 수요처 이름",
        error: "목록에 있는 수요처 이름만 선택할 수 있어요. (필수 항목입니다)",
      };
    }

    // 💡 D열(조)은 등록된 조 이름 중에서만 고르도록 드롭다운 검증을 건다 (미입력 시 미배정)
    if (groupListRange) {
      row.getCell(4).dataValidation = {
        type: "list",
        allowBlank: true,
        formulae: [groupListRange],
        showErrorMessage: true,
        errorTitle: "잘못된 조 이름",
        error: "목록에 있는 조 이름만 선택할 수 있어요.",
      };
    }

    // 💡 E열(성별)은 "남성"/"여성" 둘뿐이라 별도 숨김 시트 없이 인라인 목록으로 검증한다.
    // 필수 항목이라 allowBlank: false로 둬서 빈 채로 남겨도 되는 것처럼 보이지 않게 한다
    // (실제 필수 검증은 업로드 시 parseParticipantsFile/서버에서 한다 — 엑셀 자체는
    // 이미 값이 있던 셀을 지울 때만 이 표시가 뜨고, 애초에 안 건드린 빈 셀은 못 잡는다).
    row.getCell(5).dataValidation = {
      type: "list",
      allowBlank: false,
      formulae: ['"남성,여성"'],
      showErrorMessage: true,
      errorTitle: "잘못된 성별",
      error: "남성 또는 여성만 선택할 수 있어요. (필수 항목입니다)",
    };
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

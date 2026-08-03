import { useMutation } from "@tanstack/react-query";
import { useState } from "react";

import {
  downloadActivityLogExcel,
  downloadActivityPaymentLedgerExcel,
  downloadAttendanceExcel,
  downloadPaymentExcel,
  downloadPayslipExcel,
  downloadWorkScheduleExcel,
} from "../../api/admin/excel";
import ConfirmModal from "../../../components/molecule/ConfirmModal";
import {
  exportBtnClass,
  exportCardClass,
  exportDescClass,
  exportGridClass,
  exportIconClass,
  exportNameClass,
  monthSelectClass,
} from "../../uiClasses";
import { getLocalYearMonth } from "../../../utils/timeFormat";

interface ProgramExcelExportSectionProps {
  programId: number;
  programType: string | null;
}

type ExcelExportItem = {
  key: string;
  icon: string;
  name: string;
  desc: string;
  download: ((programId: number, month: string) => void) | null;
};

const PUBLIC_INTEREST_ITEMS: ExcelExportItem[] = [
  {
    key: "activityLog",
    icon: "📝",
    name: "활동 대장",
    desc: "참여자별 월간 활동 기록 대장입니다.",
    download: downloadActivityLogExcel,
  },
  {
    key: "activityPayment",
    icon: "💵",
    name: "활동비 지급 대장",
    desc: "참여자별 월간 활동비 지급 내역입니다.",
    download: downloadActivityPaymentLedgerExcel,
  },
];

const COMPETENCY_ITEMS: ExcelExportItem[] = [
  {
    key: "attendance",
    icon: "🗓️",
    name: "출근부",
    desc: "참여자별 월간 출근·결근 현황입니다.",
    download: downloadAttendanceExcel,
  },
  {
    key: "workSchedule",
    icon: "📅",
    name: "근무 스케줄",
    desc: "참여자별 월간 근무 스케줄표입니다.",
    download: downloadWorkScheduleExcel,
  },
  {
    key: "payment",
    icon: "💰",
    name: "급여대장",
    desc: "참여자별 월간 급여 지급 내역입니다.",
    download: downloadPaymentExcel,
  },
  {
    key: "payslip",
    icon: "🧾",
    name: "급여 명세서",
    desc: "참여자 개인별 급여 명세서입니다.",
    download: downloadPayslipExcel,
  },
];

/**
 * 관리자 페이지 > 사업단 상세 페이지의 양식 출력 섹션입니다.
 *
 */
const ProgramExcelExportSection = ({ programId, programType }: ProgramExcelExportSectionProps) => {
  const [months, setMonths] = useState<Record<string, string>>({});
  const [downloadError, setDownloadError] = useState<string | null>(null);

  // 로딩/에러 상태 관리 용도로만 사용
  const downloadMutation = useMutation({
    mutationFn: async ({ item, month }: { item: ExcelExportItem; month: string }) => {
      await item.download?.(programId, month);
    },
  });

  // 사업 유형이 없거나(null) 예상 못한 값이면 두 유형 서식을 모두 노출
  const items =
    programType === "공익 활동"
      ? PUBLIC_INTEREST_ITEMS
      : programType === "역량 활동"
        ? COMPETENCY_ITEMS
        : [...PUBLIC_INTEREST_ITEMS, ...COMPETENCY_ITEMS];

  const handleDownloadButtonClick = (item: ExcelExportItem, month: string) => {
    downloadMutation.mutate(
      { item, month },
      {
        onError: (error) =>
          setDownloadError(error instanceof Error ? error.message : "다운로드에 실패했습니다."),
      },
    );
  };

  return (
    <div className={exportGridClass}>
      {items.map((item) => {
        const ready = item.download !== null;
        const month = months[item.key] ?? getLocalYearMonth();
        const isDownloading =
          downloadMutation.isPending && downloadMutation.variables?.item.key === item.key;

        return (
          <div key={item.key} className={exportCardClass}>
            <div className={exportIconClass}>{item.icon}</div>
            <div className={exportNameClass}>{item.name}</div>
            <div className={exportDescClass}>{item.desc}</div>
            <div className="flex flex-col gap-2.5">
              <input
                type="month"
                className={monthSelectClass}
                value={month}
                disabled={!ready}
                onChange={(event) =>
                  setMonths((current) => ({
                    ...current,
                    [item.key]: event.target.value,
                  }))
                }
              />
              <button
                className={`${exportBtnClass} disabled:opacity-40 disabled:cursor-not-allowed`}
                disabled={!ready || isDownloading}
                onClick={() => handleDownloadButtonClick(item, month)}
              >
                {isDownloading ? "다운로드 중..." : ready ? "엑셀 다운로드" : "준비중"}
              </button>
            </div>
          </div>
        );
      })}

      <ConfirmModal
        isOpen={!!downloadError}
        messages={downloadError ? [downloadError] : []}
        onConfirm={() => setDownloadError(null)}
        onClose={() => setDownloadError(null)}
      />
    </div>
  );
};

export default ProgramExcelExportSection;

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { getLocalYearMonth } from "../../../utils/timeFormat";
import {
  downloadActivityLogExcel,
  downloadActivityPaymentLedgerExcel,
  downloadAttendanceExcel,
  downloadPaymentExcel,
  downloadPayslipExcel,
  downloadWorkScheduleExcel,
} from "../../api/admin/excel";
import { updateProgramMutationOptions } from "../../api/admin/programs";
import { DEFAULT_CAPACITY_ATTENDANCE_BANNER_TEXT } from "../../utils/excel/downloadCapacityAttendanceExcel";

import ConfirmModal from "../../../components/molecule/ConfirmModal";
import FormField from "../../components/FormField";
import Input from "../../components/Input";

import {
  exportBtnClass,
  exportCardClass,
  exportDescClass,
  exportGridClass,
  exportIconClass,
  exportNameClass,
  monthSelectClass,
} from "../../uiClasses";

interface ProgramExcelExportSectionProps {
  programId: number;
  programType: string | null;
  activityLogTitle: string | null;
  capacityAttendanceBannerText: string | null;
}

type ExcelExportItem = {
  key: string;
  icon: string;
  name: string;
  desc: string;
  download: ((programId: number, month: string, customText?: string | null) => void) | null;
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
const ProgramExcelExportSection = ({
  programId,
  programType,
  activityLogTitle,
  capacityAttendanceBannerText,
}: ProgramExcelExportSectionProps) => {
  const queryClient = useQueryClient();
  const [months, setMonths] = useState<Record<string, string>>({});
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const [bannerTextInput, setBannerTextInput] = useState(capacityAttendanceBannerText ?? "");

  // 로딩/에러 상태 관리 용도로만 사용
  const downloadMutation = useMutation({
    mutationFn: async ({ item, month }: { item: ExcelExportItem; month: string }) => {
      const customText =
        item.key === "activityLog"
          ? activityLogTitle
          : item.key === "attendance"
            ? bannerTextInput
            : undefined;
      await item.download?.(programId, month, customText);
    },
  });

  const updateProgramMutation = useMutation(updateProgramMutationOptions(queryClient));

  // 사업 유형이 없거나(null) 예상 못한 값이면 두 유형 서식을 모두 노출
  const items =
    programType === "공익 활동"
      ? PUBLIC_INTEREST_ITEMS
      : programType === "역량 활용"
        ? COMPETENCY_ITEMS
        : [...PUBLIC_INTEREST_ITEMS, ...COMPETENCY_ITEMS];

  const handleDownloadButtonClick = (exportItem: ExcelExportItem, month: string) => {
    downloadMutation.mutate(
      { item: exportItem, month },
      {
        onError: (error) =>
          setDownloadError(error instanceof Error ? error.message : "다운로드에 실패했습니다."),
      },
    );
  };

  const handleBannerTextInputBlur = () => {
    const trimmed = bannerTextInput.trim();
    if (trimmed === (capacityAttendanceBannerText ?? "")) return;

    updateProgramMutation.mutate({
      id: programId,
      data: { capacityAttendanceBannerText: trimmed || null },
    });
  };

  return (
    <div className={exportGridClass}>
      {items.map((exportItem) => {
        const ready = exportItem.download !== null;
        const month = months[exportItem.key] ?? getLocalYearMonth();
        const isDownloading =
          downloadMutation.isPending && downloadMutation.variables?.item.key === exportItem.key;

        return (
          <div key={exportItem.key} className={exportCardClass}>
            <div className={exportIconClass}>{exportItem.icon}</div>
            <div className={exportNameClass}>{exportItem.name}</div>
            <div className={exportDescClass}>{exportItem.desc}</div>
            {exportItem.key === "attendance" && (
              <FormField label="출근부 공통 문구">
                <Input
                  className="mb-2.5 text-[12.5px]"
                  value={bannerTextInput}
                  placeholder={DEFAULT_CAPACITY_ATTENDANCE_BANNER_TEXT.replace(/\n/g, " ")}
                  onChange={(event) => setBannerTextInput(event.target.value)}
                  onBlur={handleBannerTextInputBlur}
                />
              </FormField>
            )}
            <div className="flex flex-col gap-2.5">
              <input
                type="month"
                className={monthSelectClass}
                value={month}
                disabled={!ready}
                onChange={(event) =>
                  setMonths((current) => ({
                    ...current,
                    [exportItem.key]: event.target.value,
                  }))
                }
              />
              <button
                className={`${exportBtnClass} disabled:opacity-40 disabled:cursor-not-allowed`}
                disabled={!ready || isDownloading}
                onClick={() => handleDownloadButtonClick(exportItem, month)}
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

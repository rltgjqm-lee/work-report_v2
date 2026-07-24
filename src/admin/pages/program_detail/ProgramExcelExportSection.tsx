import { useState } from "react";

import {
  downloadActivityLogExcel,
  downloadActivityPaymentLedgerExcel,
  downloadAttendanceExcel,
  downloadPaymentExcel,
  downloadPayslipExcel,
  downloadWorkScheduleExcel,
} from "../../api/admin/excel";
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
}

type ExcelExportItem = {
  key: string;
  icon: string;
  name: string;
  desc: string;
  download: ((programId: number, month: string) => void) | null;
};

const currentMonth = () => new Date().toISOString().slice(0, 7);

// 사업 유형별로 필요한 서식이 다르다 — 공익 활동은 활동/활동비 위주, 역량 활동은
// 근태/급여 위주. download가 null인 항목은 아직 서식이 없어 "준비중"으로만 보여준다.
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
 * 서식별로 카드가 따로 있고, 월도 카드마다 독립적으로 고른다.
 */
const ProgramExcelExportSection = ({
  programId,
  programType,
}: ProgramExcelExportSectionProps) => {
  const [months, setMonths] = useState<Record<string, string>>({});

  // TODO: 테스트 끝나면 사업 유형별로 다시 분기하기 (공익 활동/역량 활동)
  void programType;
  const items = [...PUBLIC_INTEREST_ITEMS, ...COMPETENCY_ITEMS];

  return (
    <div className={exportGridClass}>
      {items.map((item) => {
        const ready = item.download !== null;
        const month = months[item.key] ?? currentMonth();

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
                disabled={!ready}
                onClick={() => item.download?.(programId, month)}
              >
                {ready ? "엑셀 다운로드" : "준비중"}
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default ProgramExcelExportSection;

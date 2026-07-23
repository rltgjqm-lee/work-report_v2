import { useState } from "react";

import {
  downloadActivityLogExcel,
  downloadAttendanceExcel,
  downloadPaymentExcel,
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
}

const currentMonth = () => new Date().toISOString().slice(0, 7);

const EXCEL_ITEMS = [
  {
    key: "activityLog",
    icon: "📝",
    name: "활동일지",
    desc: "참여자별 월간 활동 기록 일지입니다.",
    download: downloadActivityLogExcel,
  },
  {
    key: "attendance",
    icon: "🗓️",
    name: "출근부",
    desc: "참여자별 월간 출근·결근 현황입니다.",
    download: downloadAttendanceExcel,
  },
  {
    key: "payment",
    icon: "💰",
    name: "급여대장",
    desc: "참여자별 월간 급여 지급 내역입니다.",
    download: downloadPaymentExcel,
  },
] as const;

/**
 * 관리자 페이지 > 사업단 상세 페이지의 엑셀 출력 섹션입니다.
 * 서식별로 카드가 따로 있고, 월도 카드마다 독립적으로 고른다.
 */
const ProgramExcelExportSection = ({
  programId,
}: ProgramExcelExportSectionProps) => {
  const [months, setMonths] = useState<Record<string, string>>({
    activityLog: currentMonth(),
    attendance: currentMonth(),
    payment: currentMonth(),
  });

  return (
    <div className={exportGridClass}>
      {EXCEL_ITEMS.map((item) => (
        <div key={item.key} className={exportCardClass}>
          <div className={exportIconClass}>{item.icon}</div>
          <div className={exportNameClass}>{item.name}</div>
          <div className={exportDescClass}>{item.desc}</div>
          <div className="flex flex-col gap-2.5">
            <input
              type="month"
              className={monthSelectClass}
              value={months[item.key]}
              onChange={(event) =>
                setMonths((current) => ({
                  ...current,
                  [item.key]: event.target.value,
                }))
              }
            />
            <button
              className={exportBtnClass}
              onClick={() => item.download(programId, months[item.key])}
            >
              엑셀 다운로드
            </button>
          </div>
        </div>
      ))}
    </div>
  );
};

export default ProgramExcelExportSection;

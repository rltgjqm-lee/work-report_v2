import {
  downloadActivityLogExcel,
  downloadAttendanceExcel,
  downloadPaymentExcel,
} from "../../api/admin/excel";
import { btnGhostClass, inputClass } from "../../uiClasses";

interface ProgramExcelExportSectionProps {
  programId: number;
  exportMonth: string;
  onExportMonthChange: (value: string) => void;
}

const ProgramExcelExportSection = ({
  programId,
  exportMonth,
  onExportMonthChange,
}: ProgramExcelExportSectionProps) => (
  <div className="bg-white border border-[#e2e5eb] rounded-[2px] mb-5">
    <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-[#eceef1] flex-wrap">
      <span className="text-sm font-bold">엑셀 출력</span>
      <div className="flex items-center gap-2.5">
        <input
          type="month"
          className={inputClass}
          value={exportMonth}
          onChange={(event) => onExportMonthChange(event.target.value)}
        />
        <button
          className={btnGhostClass}
          onClick={() => downloadActivityLogExcel(programId, exportMonth)}
        >
          활동일지
        </button>
        <button
          className={btnGhostClass}
          onClick={() => downloadAttendanceExcel(programId, exportMonth)}
        >
          출근부
        </button>
        <button
          className={btnGhostClass}
          onClick={() => downloadPaymentExcel(programId, exportMonth)}
        >
          급여대장
        </button>
      </div>
    </div>
  </div>
);

export default ProgramExcelExportSection;

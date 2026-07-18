import { useEffect, useRef, useState } from "react";

import type { ActivityLogFormData, ActivityLogItem } from "../../types/form";
import { PdfTemplate } from "../../components/organism/PdfTemplate";
import AppBar from "../../components/appshell/AppBar";
import BottomBar, { BottomBarRow } from "../../components/appshell/BottomBar";
import TabBar, { type TabKey } from "../../components/appshell/TabBar";
import { pageClass, btnOutlineClass } from "../../components/appshell/classes";

import { downloadActivityLogExcel } from "../../utils/downloadActivityLogExcel";
import { downloadActivityLogPdf } from "../../utils/downloadActivityLogPdf";
import { INDEXED_DB_CONFIG } from "../../constants/storage";

interface PageListProps {
  formData: ActivityLogFormData;
  db: IDBDatabase | null;
  onChangeTab: (tab: TabKey) => void;
  onAlert: (messages: string[]) => void;
}

const PageList = ({ formData, db, onChangeTab, onAlert }: PageListProps) => {
  const [currentYear, setCurrentYear] = useState<number>(() =>
    new Date().getFullYear(),
  );
  const [currentMonth, setCurrentMonth] = useState<number>(
    () => new Date().getMonth() + 1,
  );
  const [logs, setLogs] = useState<ActivityLogItem[]>([]);

  const printAreaRef = useRef<HTMLDivElement>(null);

  const handleChangeMonth = (delta: number) => {
    setCurrentMonth((prev) => {
      const nextMonth = prev + delta;
      if (nextMonth > 12) {
        setCurrentYear((y) => y + 1);
        return 1;
      } else if (nextMonth < 1) {
        setCurrentYear((y) => y - 1);
        return 12;
      }
      return nextMonth;
    });
  };

  const getFileName = (ext: string) => {
    const monthStr = String(currentMonth).padStart(2, "0");
    return `${currentYear}년${monthStr}월 ${formData.orgName}_${formData.projectName}_${formData.userName}.${ext}`;
  };

  const filteredLogs = logs.filter((log) => {
    if (!log.date) return false;
    const [y, m] = log.date.split("-");
    return parseInt(y) === currentYear && parseInt(m) === currentMonth;
  });

  const handleClickExportReportsButton = async () => {
    if (!db) return;

    if (filteredLogs.length === 0) {
      onAlert(["해당 월에 출력할 일지 내역이 없습니다."]);
      return;
    }

    onAlert([
      "📊 엑셀과 PDF 파일이 동시에 다운로드됩니다.",
      "파일이 생성될 때까지 잠시만 기다려주세요.",
    ]);

    await downloadActivityLogExcel({
      filteredLogs,
      formData,
      fileName: getFileName("xlsx"),
    });

    setTimeout(async () => {
      if (printAreaRef.current) {
        await downloadActivityLogPdf({
          element: printAreaRef.current,
          fileName: getFileName("pdf"),
        });
      }
    }, 1000);
  };

  useEffect(() => {
    if (!db) return;

    try {
      const tx = db.transaction(INDEXED_DB_CONFIG.STORE_NAME, "readonly");
      const store = tx.objectStore(INDEXED_DB_CONFIG.STORE_NAME);
      const req = store.getAll();

      req.onsuccess = (e) => {
        const allLogs: ActivityLogItem[] =
          (e.target as IDBRequest).result || [];
        allLogs.sort((a, b) => b.timestamp - a.timestamp);
        setLogs(allLogs);
      };
    } catch (error) {
      console.error("데이터 동기화 실패:", error);
    }
  }, [db, currentYear, currentMonth]);

  return (
    <div className={pageClass}>
      <AppBar title="활동 일지 목록" />
      <div className="px-5 pt-4 pb-5 flex-1 flex flex-col gap-3.5 overflow-y-auto">
        <div className="flex items-center justify-between bg-white rounded-2xl px-4 py-3 shadow-[0_1px_2px_rgba(20,30,50,0.04)]">
          <button
            className="w-[42px] h-[42px] rounded-xl border-none bg-[#f2f4f6] text-[17px] font-bold text-[#3182f6] cursor-pointer"
            onClick={() => handleChangeMonth(-1)}
          >
            ◀
          </button>
          <span className="text-[17px] font-extrabold text-[#1f2937]">
            {currentYear}년 {currentMonth}월
          </span>
          <button
            className="w-[42px] h-[42px] rounded-xl border-none bg-[#f2f4f6] text-[17px] font-bold text-[#3182f6] cursor-pointer"
            onClick={() => handleChangeMonth(1)}
          >
            ▶
          </button>
        </div>

        {filteredLogs.length === 0 ? (
          <div className="text-center p-8 text-[#9ca3af] text-[14px]">
            이 달에 작성된 일지가 없습니다.
          </div>
        ) : (
          filteredLogs.map((log, index) => (
            <div
              key={log.id || index}
              className="flex items-center justify-between bg-white rounded-2xl px-[18px] py-4 shadow-[0_1px_2px_rgba(20,30,50,0.04)]"
            >
              <div>
                <div className="text-[16px] font-extrabold text-[#1f2937]">
                  {log.date}
                </div>
                <div className="text-[13.5px] text-[#6b7280] font-semibold mt-1">
                  {log.start} ~ {log.end}
                </div>
                <div className="text-[13.5px] text-[#9ca3af] mt-0.5">
                  {log.content}
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      <BottomBar>
        <BottomBarRow>
          <button
            className={btnOutlineClass}
            onClick={handleClickExportReportsButton}
          >
            보고서 출력
          </button>
        </BottomBarRow>
      </BottomBar>
      <TabBar active="list" onChange={onChangeTab} />

      <PdfTemplate
        printRef={printAreaRef}
        formData={formData}
        filteredLogs={filteredLogs}
      />
    </div>
  );
};

export default PageList;

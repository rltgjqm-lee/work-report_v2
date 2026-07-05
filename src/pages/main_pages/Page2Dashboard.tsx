import { useState, useRef, useEffect } from "react";

import type { ActivityLogFormData, ActivityLogItem } from "../../types/form";

import Button from "../../components/atoms/Button";
import { PdfTemplate } from "../../components/organism/PdfTemplate";

import { downloadActivityLogExcel } from "../../utils/downloadActivityLogExcel";
import { downloadActivityLogPdf } from "../../utils/downloadActivityLogPdf";

import { INDEXED_DB_CONFIG } from "../../constants/storage";

interface Page2Props {
  formData: ActivityLogFormData;
  db: IDBDatabase | null;
  setFormData: React.Dispatch<React.SetStateAction<ActivityLogFormData>>;
  onNavigateToPage3: () => void;
  onAlert: (messages: string[]) => void;
}

/**
 * Page 2: 활동 일지 대시보드
 */
const Page2Dashboard = ({
  formData,
  db,
  setFormData,
  onNavigateToPage3,
  onAlert,
}: Page2Props) => {
  // 1. 달력 연/월 제어 및 일지 피드 보관용 로컬 상태
  const [currentYear, setCurrentYear] = useState<number>(() =>
    new Date().getFullYear(),
  );
  const [currentMonth, setCurrentMonth] = useState<number>(
    () => new Date().getMonth() + 1,
  );
  const [logs, setLogs] = useState<ActivityLogItem[]>([]);

  // 2. 가상 인쇄 레이어를 조준할 리액트 전용 훅
  const printAreaRef = useRef<HTMLDivElement>(null);

  // 3. 달력 스위칭 증감 연산 핸들러
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

  // 4. 새로운 일지 서식 진입 핸들러 (활동 스코프 비우기)
  const handleClickNewLogButton = () => {
    setFormData((prev) => ({
      ...prev,
      actDate: "",
      startTime: { ampm: "AM", hour: "", minute: "" },
      endTime: { ampm: "PM", hour: "", minute: "" },
      actTotalTime: "- 시간",
      actContent: "",
      actPlace: "",
      hasAccident: false,
      accidentDetail: "",
      accidentAction: "업무수행",
    }));
    onNavigateToPage3();
  };

  // 5. 다운로드용 파일명 마스킹 포맷터
  const getFileName = (ext: string) => {
    const monthStr = String(currentMonth).padStart(2, "0");
    return `${currentYear}년${monthStr}월 ${formData.orgName}_${formData.projectName}_${formData.userName}.${ext}`;
  };

  // 6. 현재 대시보드 시점에 필터링된 데이터 조각 계산
  const filteredLogs = logs.filter((log) => {
    if (!log.date) return false; // 💡 손상되었거나 구버전 스키마의 레코드 방어
    const [y, m] = log.date.split("-");
    return parseInt(y) === currentYear && parseInt(m) === currentMonth;
  });

  // 7. [출력 제어 총괄] 엑셀과 PDF 연쇄 드롭
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

    // ① 외부 분리형 ExcelJS 엔진 가동
    await downloadActivityLogExcel({
      filteredLogs,
      formData,
      fileName: getFileName("xlsx"),
    });

    // ② 리액트 Ref 타겟팅 PDF 가동 (1초 텀 유지)
    setTimeout(async () => {
      if (printAreaRef.current) {
        await downloadActivityLogPdf({
          element: printAreaRef.current,
          fileName: getFileName("pdf"),
        });
      }
    }, 1000);
  };

  // 8. 달력 이동 시 실시간 로컬 DB 동기화 이펙트
  useEffect(() => {
    if (!db) return;

    try {
      const tx = db.transaction(INDEXED_DB_CONFIG.STORE_NAME, "readonly");
      const store = tx.objectStore(INDEXED_DB_CONFIG.STORE_NAME);
      const req = store.getAll();

      req.onsuccess = (e) => {
        const allLogs: ActivityLogItem[] =
          (e.target as IDBRequest).result || [];
        // 리스트 정렬 조건 적용 (최신순)
        allLogs.sort((a, b) => b.timestamp - a.timestamp);
        setLogs(allLogs);
      };
    } catch (error) {
      console.error("데이터 동기화 실패:", error);
    }
  }, [db, currentYear, currentMonth]);

  return (
    <div
      className="p-[30px_20px] flex flex-1 flex-col max-[600px]:p-[20px_15px]"
      id="page2"
    >
      {/* 환영 영역 */}
      <div className="text-[22px] font-bold mb-[25px] text-[#2c3e50] text-left tracking-[-0.5px] max-[600px]:text-[20px] max-[600px]:mb-[18px]">
        <span className="text-[#4364F7]">{formData.userName || "참여자"}</span>
        님 환영합니다 <br />
        <span className="text-[16px] text-[#7f8c8d]">
          {formData.projectName || "등록된 사업이 없습니다."}
        </span>
      </div>

      {/* 연/월 패널 */}
      <div className="flex justify-between items-center mb-[15px] bg-white p-[10px_15px] rounded-xl shadow-[0_1px_3px_rgba(0,0,0,0.1)]">
        <button
          className="flex-none p-[5px_20px] text-[18px] font-bold font-sans rounded-xl cursor-pointer bg-white text-[#222] border border-[#222]"
          onClick={() => handleChangeMonth(-1)}
        >
          ◀
        </button>
        <div className="text-[18px] font-bold text-[#2c3e50]">
          {currentYear}년 {currentMonth}월
        </div>
        <button
          className="flex-none p-[5px_20px] text-[18px] font-bold font-sans rounded-xl cursor-pointer bg-white text-[#222] border border-[#222]"
          onClick={() => handleChangeMonth(1)}
        >
          ▶
        </button>
      </div>

      {/* 일지 리스트 */}
      <div className="flex-1 max-h-[50vh] overflow-y-auto mb-5 p-2.5 bg-[#f0f3f5] rounded-xl grid grid-cols-3 gap-2.5 content-start max-[600px]:grid-cols-1 max-[600px]:gap-[6px] max-[600px]:p-2 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
        {filteredLogs.length === 0 ? (
          <div className="col-span-3 text-center p-5 text-[#7f8c8d] max-[600px]:col-span-1">
            이 달에 작성된 일지가 없습니다.
          </div>
        ) : (
          filteredLogs.map((log, index) => (
            <div
              key={log.id || index}
              className="bg-white p-[8px_6px] rounded-xl shadow-[0_1px_3px_rgba(0,0,0,0.1)] flex flex-col justify-between"
            >
              <div className="font-bold text-[#2c3e50] text-[12px] mb-[3px] truncate">
                {log.date}
              </div>
              <div className="text-[#34495e] text-[11px] truncate">
                {log.start}~{log.end}
              </div>
              <div className="text-[#7f8c8d] text-[11px] mt-[3px] truncate">
                {log.content}
              </div>
            </div>
          ))
        )}
      </div>

      {/* 액션 버튼 */}
      <div className="flex justify-center gap-4 mt-auto pt-5 max-[600px]:mt-5 max-[600px]:pt-0">
        <Button variant="blue" onClick={handleClickNewLogButton}>
          새로운 일지 작성하기
        </Button>
        <Button variant="white" onClick={handleClickExportReportsButton}>
          보고서 출력 (PDF / 엑셀)
        </Button>
      </div>

      {/* 💡 인쇄용 프리뷰 템플릿 */}
      <PdfTemplate
        printRef={printAreaRef}
        formData={formData}
        filteredLogs={filteredLogs}
      />
    </div>
  );
};

export default Page2Dashboard;

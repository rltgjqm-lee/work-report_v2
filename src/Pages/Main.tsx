import { useState } from "react";

import ConfirmModal from "../components/molecule/ConfirmModal";
// import LabeledInput from "../components/molecule/LabeledInput";
import PdfTemplate from "../components/organism/PdfTemplate";
import Button from "../components/atoms/Button";

import type { ActivityLogFormData } from "../types/form";
// import { PAGE1_RULES } from "../types/validationRules";
// import { LOCAL_STORAGE_KEYS } from "../constants/storage";

// import { validateForm } from "../utils/validateFormData";

import Page1OnConfig from "./main_pages/Page1OnConfig";

const initialFormData: ActivityLogFormData = {
  orgName: "",
  projectName: "",
  demandName: "",
  userName: "",
  actDate: "",
  startTime: { ampm: "AM", hour: "09", minute: "00" },
  endTime: { ampm: "PM", hour: "01", minute: "00" },
  actTotalTime: "- 시간",
  actContent: "",
  actPlace: "",
  hasAccident: false,
  accidentDetail: "",
  accidentAction: "업무수행",
  userSignature: "",
  demandSignature: "",
  saveSignatureConsent: true,
};

const Main = () => {
  const [page, setPage] = useState<number>(1);

  const goNextStep = () => setPage((prev) => Math.min(prev + 1, 6));
  // const prevStep = () => setPage((prev) => Math.max(prev - 1, 1));
  const goHome = () => setPage(1);

  // 모달 상태
  const [modalOpen, setModalOpen] = useState(false);
  const [modalMessages, setModalMessages] = useState<string[]>([]);

  const [formData, setFormData] =
    useState<ActivityLogFormData>(initialFormData);

  const handleInputChange = <T extends keyof ActivityLogFormData>(
    field: T,
    value: ActivityLogFormData[T],
  ) => {
    setFormData((prev) => ({
      ...prev,
      // value가 문자열일 때만 trim()을 하고, 아니면 그대로 넣어서 에러를 방지합니다.
      [field]: typeof value === "string" ? value.trim() : value,
    }));
  };

  // 기존 비즈니스 로직 함수들 (저장 등)
  const savePage3 = () => {
    /* 저장 로직 */
  };
  const savePage4 = () => {
    /* 저장 로직 */
  };
  const savePage5 = () => {
    /* 저장 로직 */
  };
  const saveLog = () => {
    /* 저장 로직 */
  };

  const updateHiddenTime = (type: string) => type;
  const toggleAccidentInput = (bool: boolean) => bool;
  const exportReports = () => {};
  const exportReportsFromPage6 = () => {};

  // 모달 공용 헬퍼 함수
  const openAlertModal = (messages: string[]) => {
    setModalMessages(messages);
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
  };

  return (
    <div className="w-full h-dvh flex justify-center items-stretch bg-[#f0f0f0] p-0 min-[601px]:p-4 select-none">
      <div className="w-full h-full bg-white rounded-xl overflow-hidden flex flex-col items-stretch content-stretch relative box-border max-[600px]:w-[calc(100%-20px)] max-[600px]:shadow-md max-[600px]:m-[12px_10px_0_10px]">
        {/* 1. 초기 설정 페이지 */}
        {page === 1 && (
          <Page1OnConfig
            formData={formData}
            onChange={handleInputChange}
            onNext={goNextStep}
            onAlert={openAlertModal}
          />
        )}

        {/* 2. 대시보드 페이지 */}
        {page === 2 && (
          <Page2Dashboard
            onStartNewLog={() => setPage(3)}
            onExportReports={exportReports}
          />
        )}

        {/* 3. 활동 일시 페이지 */}
        {page === 3 && (
          <Page3DateTime
            onSave={savePage3}
            onNext={goNextStep}
            onUpdateTime={updateHiddenTime}
          />
        )}

        {/* 4. 활동 내용/장소 페이지 */}
        {page === 4 && (
          <Page4ContentPlace onSave={savePage4} onNext={goNextStep} />
        )}

        {/* 5. 안전사고 유무 페이지 */}
        {page === 5 && (
          <Page5Accident
            onSave={savePage5}
            onNext={goNextStep}
            onToggleAccident={toggleAccidentInput}
          />
        )}

        {/* 6. 서명하기 페이지 */}
        {page === 6 && (
          <Page6Signature
            onSave={saveLog}
            onExport={exportReportsFromPage6}
            onHome={goHome}
          />
        )}
      </div>

      {/* PDF 렌더링용 숨김 템플릿 */}
      <PdfTemplate
        activityRows={
          <tr>
            <td>1</td>
            <td>2026-07-03</td>
            <td>09:00</td>
            <td>12:00</td>
            <td>3시간</td>
            <td>길거리 환경 미화 활동 진행</td>
            <td>00동 일대</td>
            <td>없음</td>
            <td>(서명)</td>
            <td>(서명)</td>
          </tr>
        }
      />

      {/* 알림 모달 */}
      <ConfirmModal
        isOpen={modalOpen}
        messages={modalMessages}
        onConfirm={closeModal} // 확인 누르면 닫히게 설정
        onClose={closeModal}
      />
    </div>
  );
};

export default Main;

// ==========================================
// 하위 페이지 컴포넌트들
// ==========================================

/* Page 2: 대시보드 */
const Page2Dashboard = ({
  onStartNewLog,
  onExportReports,
}: {
  onStartNewLog: () => void;
  onExportReports: () => void;
}) => (
  <div
    className="p-[30px_20px] flex-1 flex-col max-[600px]:p-[20px_15px]"
    id="page2"
    style={{ display: "none" }}
  >
    <div className="text-[22px] font-bold mb-[25px] text-[#2c3e50] text-left tracking-[-0.5px] max-[600px]:text-[20px] max-[600px]:mb-[18px]">
      <span id="dUser" className="text-[#4364F7]">
        홍길동
      </span>
      님 환영합니다 <br />
      <span className="text-[16px] text-[#7f8c8d]" id="dOrg">
        노인일자리 및 사회활동 지원사업
      </span>
    </div>

    <div className="flex justify-between items-center mb-[15px] bg-white p-[10px_15px] rounded-xl shadow-[0_1px_3px_rgba(0,0,0,0.1)]">
      <button className="flex-none p-[5px_20px] text-[18px] font-bold font-sans rounded-xl cursor-pointer bg-white text-[#222] border border-[#222]">
        ◀
      </button>
      <div
        id="currentMonthDisplay"
        className="text-[18px] font-bold text-[#2c3e50]"
      >
        2026년 5월
      </div>
      <button className="flex-none p-[5px_20px] text-[18px] font-bold font-sans rounded-xl cursor-pointer bg-white text-[#222] border border-[#222]">
        ▶
      </button>
    </div>
    <div
      className="flex-1 max-h-[50vh] overflow-y-auto mb-5 p-2.5 bg-[#f0f3f5] rounded-xl grid grid-cols-3 gap-2.5 content-start max-[600px]:gap-[6px] max-[600px]:p-2 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]"
      id="activityList"
    ></div>

    <div className="flex flex-col gap-2.5 mt-auto pt-5 max-[600px]:mt-5 max-[600px]:pt-0">
      <Button
        variant="blue"
        onClick={onStartNewLog}
        className="w-full flex-none"
      >
        새로운 일지 작성하기
      </Button>
      <Button
        variant="white"
        onClick={onExportReports}
        className="w-full flex-none"
      >
        보고서 출력 (PDF / 엑셀)
      </Button>
    </div>
  </div>
);

/* Page 3: 활동 일시 */
const Page3DateTime = ({
  onSave,
  onNext,
  onUpdateTime,
}: {
  onSave: () => void;
  onNext: () => void;
  onUpdateTime: (type: string) => void;
}) => (
  <div
    className="p-[30px_20px] flex-1 flex-col max-[600px]:p-[20px_15px]"
    id="page3"
    style={{ display: "none" }}
  >
    <div className="text-[22px] font-bold mb-[25px] text-[#2c3e50] text-left tracking-[-0.5px] max-[600px]:text-[20px] max-[600px]:mb-[18px]">
      활동 일시를 입력해주세요
    </div>
    <div className="flex flex-col items-start mb-[25px] gap-2.5 max-[600px]:mb-[18px] max-[600px]:gap-[6px] w-full">
      <div className="text-[16px] font-bold w-full text-[#34495e] max-[600px]:text-[15px] max-[600px]:mb-[2px]">
        활동일{" "}
        <span className="text-[12px] font-normal text-[#e74c3c]">
          (*활동일을 선택하여 주세요)
        </span>
      </div>
      <input
        type="date"
        id="actDate"
        className="w-full p-[14px] text-[16px] font-sans border-[2.5px] border-[#2c3e50] rounded-xl outline-none box-border max-[600px]:p-[10px] max-[600px]:text-[14px] max-[600px]:border-[1.5px]"
      />
    </div>
    <div className="flex flex-col items-start mb-[25px] gap-2.5 max-[600px]:mb-[18px] max-[600px]:gap-[6px] w-full">
      <div className="text-[16px] font-bold w-full text-[#34495e] max-[600px]:text-[15px] max-[600px]:mb-[2px]">
        활동시간을 선택하여 주세요 <br />
        <span className="text-[12px] font-normal text-[#e74c3c]">
          (*활동 종료 후 시간을 선택하여 주세요)
        </span>
      </div>
      <div className="flex flex-col gap-3 w-full">
        <div className="w-full">
          <div className="mb-1 font-bold text-[#34495e] text-[14px]">시작</div>
          <div className="flex gap-2 w-full">
            <select
              id="startAmpm"
              className="text-center w-auto flex-1 p-2 border-[2.5px] border-[#2c3e50] rounded-xl outline-none text-[14px] max-[600px]:p-[6px_2px] max-[600px]:text-[12px] max-[600px]:border-[1.5px]"
              onChange={() => onUpdateTime("start")}
              defaultValue="AM"
            >
              <option value="AM">오전</option>
              <option value="PM">오후</option>
            </select>
            <select
              id="startHour"
              className="text-center w-auto flex-1 p-2 border-[2.5px] border-[#2c3e50] rounded-xl outline-none text-[14px] max-[600px]:p-[6px_2px] max-[600px]:text-[12px] max-[600px]:border-[1.5px]"
              onChange={() => onUpdateTime("start")}
            ></select>
            <span className="text-[16px] font-bold align-self-center self-center">
              :
            </span>
            <select
              id="startMin"
              className="text-center w-auto flex-1 p-2 border-[2.5px] border-[#2c3e50] rounded-xl outline-none text-[14px] max-[600px]:p-[6px_2px] max-[600px]:text-[12px] max-[600px]:border-[1.5px]"
              onChange={() => onUpdateTime("start")}
            ></select>
          </div>
          <input type="hidden" id="actStart" />
        </div>
        <div className="w-full">
          <div className="mb-1 font-bold text-[#34495e] text-[14px]">종료</div>
          <div className="flex gap-2 w-full">
            <select
              id="endAmpm"
              className="text-center w-auto flex-1 p-2 border-[2.5px] border-[#2c3e50] rounded-xl outline-none text-[14px] max-[600px]:p-[6px_2px] max-[600px]:text-[12px] max-[600px]:border-[1.5px]"
              onChange={() => onUpdateTime("end")}
              defaultValue="PM"
            >
              <option value="AM">오전</option>
              <option value="PM">오후</option>
            </select>
            <select
              id="endHour"
              className="text-center w-auto flex-1 p-2 border-[2.5px] border-[#2c3e50] rounded-xl outline-none text-[14px] max-[600px]:p-[6px_2px] max-[600px]:text-[12px] max-[600px]:border-[1.5px]"
              onChange={() => onUpdateTime("end")}
            ></select>
            <span className="text-[16px] font-bold align-self-center self-center">
              :
            </span>
            <select
              id="endMin"
              className="text-center w-auto flex-1 p-2 border-[2.5px] border-[#2c3e50] rounded-xl outline-none text-[14px] max-[600px]:p-[6px_2px] max-[600px]:text-[12px] max-[600px]:border-[1.5px]"
              onChange={() => onUpdateTime("end")}
            ></select>
          </div>
          <input type="hidden" id="actEnd" />
        </div>
      </div>
    </div>
    <div className="flex flex-col items-start mb-[25px] gap-2.5 max-[600px]:mb-[18px] max-[600px]:gap-[6px] w-full">
      <div className="font-bold text-[#34495e] mb-1">총</div>
      <div className="flex items-center gap-2.5 w-full">
        <div
          id="actTotalTime"
          className="w-full p-[14px] text-[16px] border-[2.5px] border-[#2c3e50] rounded-xl outline-none bg-[#f9f9f9] text-center color-[#00a0e9] font-bold max-[600px]:p-[10px] max-[600px]:text-[14px] max-[600px]:border-[1.5px]"
        >
          - 시간
        </div>
      </div>
    </div>

    <div className="flex justify-center gap-2 mt-auto pt-5 max-[600px]:mt-5 max-[600px]:pt-0">
      <Button variant="blue" onClick={onSave}>
        저장하기
      </Button>
      <Button variant="white" onClick={onNext}>
        다음
      </Button>
    </div>
  </div>
);

/* Page 4: 활동 내용 및 장소 */
const Page4ContentPlace = ({
  onSave,
  onNext,
}: {
  onSave: () => void;
  onNext: () => void;
}) => (
  <div
    className="p-[30px_20px] flex-1 flex-col max-[600px]:p-[20px_15px]"
    id="page4"
    style={{ display: "none" }}
  >
    <div className="text-[22px] font-bold mb-[25px] text-[#2c3e50] text-left tracking-[-0.5px] max-[600px]:text-[20px] max-[600px]:mb-[18px]">
      활동 내용 및 장소
    </div>
    <div className="flex flex-col items-start mb-[25px] gap-2.5 max-[600px]:mb-[18px] max-[600px]:gap-[6px] w-full">
      <div className="text-[16px] font-bold w-full text-[#34495e] flex-none max-[600px]:text-[15px] max-[600px]:mb-[2px]">
        활동내용
      </div>
      <textarea
        id="actContent"
        className="w-full p-[14px] text-[16px] font-sans border-[2.5px] border-[#2c3e50] rounded-xl outline-none box-border max-[600px]:p-[10px] max-[600px]:text-[14px] max-[600px]:border-[1.5px]"
        rows={2}
        placeholder="오늘 수행하신 활동 내용을 적어주세요."
      ></textarea>
    </div>
    <div className="flex flex-col items-start mb-[25px] gap-2.5 max-[600px]:mb-[18px] max-[600px]:gap-[6px] w-full">
      <div className="text-[16px] font-bold w-full text-[#34495e] flex-none max-[600px]:text-[15px] max-[600px]:mb-[2px]">
        활동장소
      </div>
      <textarea
        id="actPlace"
        className="w-full p-[14px] text-[16px] font-sans border-[2.5px] border-[#2c3e50] rounded-xl outline-none box-border max-[600px]:p-[10px] max-[600px]:text-[14px] max-[600px]:border-[1.5px]"
        rows={2}
        placeholder="활동하신 장소를 적어주세요."
      ></textarea>
    </div>

    <div className="flex justify-center gap-2 mt-auto pt-5 max-[600px]:mt-5 max-[600px]:pt-0">
      <Button variant="blue" onClick={onSave}>
        저장하기
      </Button>
      <Button variant="white" onClick={onNext}>
        다음
      </Button>
    </div>
  </div>
);

/* Page 5: 안전사고 유무 */
const Page5Accident = ({
  onSave,
  onNext,
  onToggleAccident,
}: {
  onSave: () => void;
  onNext: () => void;
  onToggleAccident: (bool: boolean) => void;
}) => (
  <div
    className="p-[30px_20px] flex-1 flex-col max-[600px]:p-[20px_15px]"
    id="page5"
    style={{ display: "none" }}
  >
    <div className="text-[22px] font-bold mb-[25px] text-[#2c3e50] text-left tracking-[-0.5px] max-[600px]:text-[20px] max-[600px]:mb-[18px]">
      안전사고 유무 확인
    </div>
    <div className="flex flex-col items-start mb-[25px] gap-2.5 max-[600px]:mb-[18px] max-[600px]:gap-[6px] w-full">
      <div className="text-[16px] font-bold w-full text-[#34495e] flex-none max-[600px]:text-[15px] max-[600px]:mb-[2px]">
        안전사고 발생유무
      </div>
      <div className="flex gap-[30px] mt-2.5 w-full flex-none max-[600px]:gap-5">
        <label className="text-[14px] flex items-center gap-2 cursor-pointer">
          <input
            type="radio"
            name="accident"
            className="w-5 h-5"
            onClick={() => onToggleAccident(true)}
          />{" "}
          유
        </label>
        <label className="text-[14px] flex items-center gap-2 cursor-pointer">
          <input
            type="radio"
            name="accident"
            className="w-5 h-5"
            defaultChecked
            onClick={() => onToggleAccident(false)}
          />{" "}
          무
        </label>
      </div>
    </div>
    <div
      className="flex flex-col items-start mb-[25px] gap-2.5 max-[600px]:mb-[18px] max-[600px]:gap-[6px] w-full"
      id="accidentDetailRow"
      style={{ display: "none" }}
    >
      <div className="text-[16px] font-bold w-full text-[#34495e] flex-none max-[600px]:text-[15px] max-[600px]:mb-[2px]">
        사고내용 및 조치내용
      </div>
      <input
        type="text"
        id="accidentDetail"
        className="w-full p-[14px] text-[16px] font-sans border-[2.5px] border-[#2c3e50] rounded-xl outline-none box-border max-[600px]:p-[10px] max-[600px]:text-[14px] max-[600px]:border-[1.5px]"
        placeholder="예) 넘어짐, 응급조치 후 지속"
      />
    </div>
    <div
      className="flex flex-col items-start mb-[25px] gap-2.5 max-[600px]:mb-[18px] max-[600px]:gap-[6px] w-full"
      id="accidentActionRow"
      style={{ display: "none" }}
    >
      <div className="text-[16px] font-bold w-full text-[#34495e] flex-none max-[600px]:text-[15px] max-[600px]:mb-[2px]">
        안전사고 발생 후 업무 수행
      </div>
      <div className="flex gap-[30px] mt-2.5 w-full flex-none max-[600px]:gap-5">
        <label className="text-[14px] flex items-center gap-2 cursor-pointer">
          <input
            type="radio"
            name="accidentAction"
            className="w-5 h-5"
            value="귀가"
          />{" "}
          귀가
        </label>
        <label className="text-[14px] flex items-center gap-2 cursor-pointer">
          <input
            type="radio"
            name="accidentAction"
            className="w-5 h-5"
            value="업무수행"
            defaultChecked
          />{" "}
          업무수행
        </label>
      </div>
    </div>

    <div className="flex justify-center gap-2 mt-auto pt-5 max-[600px]:mt-5 max-[600px]:pt-0">
      <Button variant="blue" onClick={onSave}>
        저장하기
      </Button>
      <Button variant="white" onClick={onNext}>
        다음
      </Button>
    </div>
  </div>
);

/* Page 6: 서명하기 */
const Page6Signature = ({
  onSave,
  onExport,
  onHome,
}: {
  onSave: () => void;
  onExport: () => void;
  onHome: () => void;
}) => (
  <div
    className="p-[30px_20px] flex-1 flex-col max-[600px]:p-[20px_15px]"
    id="page6"
    style={{ display: "none" }}
  >
    <div className="text-[22px] font-bold mb-[25px] text-[#2c3e50] text-left tracking-[-0.5px] max-[600px]:text-[20px] max-[600px]:mb-[18px]">
      서명을 진행해주세요
    </div>
    <div className="flex flex-col items-start mb-1 gap-2.5 w-full">
      <div className="text-[16px] font-bold w-full text-[#34495e] flex-none max-[600px]:text-[15px] max-[600px]:mb-[2px]">
        참여자 서명
      </div>
      <div className="flex-1 border-2 border-dashed border-[#bdc3c7] rounded-xl bg-[#fafafa] relative w-full flex-none mb-0">
        <canvas
          id="userCanvas"
          className="w-full h-[180px] rounded-xl touch-none max-[600px]:h-[120px]"
        ></canvas>
        <button className="absolute top-1.5 right-1.5 bg-[#ff4d4d] text-white border-none rounded p-1 text-[16px] z-20 cursor-pointer">
          지우기
        </button>
      </div>
    </div>
    <div className="text-[13px] text-[#7f8c8d] text-right mb-[25px] w-full">
      * 최초 서명 시 이후 계속 사용됩니다.
    </div>
    <div className="flex flex-col items-start mb-1 gap-2.5 w-full">
      <div className="text-[16px] font-bold w-full text-[#34495e] flex-none max-[600px]:text-[15px] max-[600px]:mb-[2px]">
        확인자 (수요처) 서명{" "}
        <span className="text-[14px] font-normal">(선택)</span>
      </div>
      <div className="flex-1 border-2 border-dashed border-[#bdc3c7] rounded-xl bg-[#fafafa] relative w-full flex-none mb-0">
        <canvas
          id="demandCanvas"
          className="w-full h-[180px] rounded-xl touch-none max-[600px]:h-[120px]"
        ></canvas>
        <button className="absolute top-1.5 right-1.5 bg-[#ff4d4d] text-white border-none rounded p-1 text-[16px] z-20 cursor-pointer">
          지우기
        </button>
      </div>
    </div>
    <label className="flex items-start gap-2 mb-[25px] cursor-pointer mt-3 w-full">
      <input
        type="checkbox"
        id="demandConsentCheck"
        defaultChecked
        className="w-[18px] h-[18px] mt-0.5"
      />
      <div className="text-[14px] text-[#2c3e50]">
        <strong>이 서명으로 계속 사용함에 동의합니다.</strong> <br />
        <span className="text-[12px] text-[#7f8c8d]">
          (체크 해제 시 다음 작성 시 서명이 지워진 채로 시작합니다)
        </span>
      </div>
    </label>

    <div className="flex justify-center gap-2 mt-auto pt-5 max-[600px]:mt-5 max-[600px]:pt-0">
      <Button variant="blue" onClick={onSave}>
        저장하기
      </Button>
      <Button variant="white" onClick={onExport}>
        보고서
      </Button>
      <Button variant="white" onClick={onHome}>
        처음으로
      </Button>
    </div>
  </div>
);

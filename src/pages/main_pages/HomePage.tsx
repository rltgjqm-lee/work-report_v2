import type { ActivityLogFormData } from "../../types/form";

interface HomePageProps {
  formData: ActivityLogFormData;
  onOpenAffiliation: () => void;
  onStartActivityLog: () => void;
}

/**
 * 앱을 켜면 누구나 가장 먼저 보는 메인 페이지 — 기본정보 등록과 활동일지 시작하기,
 * 두 갈래로 안내한다. 아직 이름이 없으면 인사말 없이 "안녕하세요"만 보여준다.
 * 아이콘/글씨 크기는 clamp(min, vw, max)로 화면 폭에 비례하되 상~하한을 둬서,
 * 넓은 화면에서 정사각형 카드 안에 빈 공간이 과하게 생기지 않게 한다.
 */
const HomePage = ({ formData, onOpenAffiliation, onStartActivityLog }: HomePageProps) => (
  <div
    className="flex flex-col h-full min-h-0 flex-1 overflow-y-auto"
    style={{ background: "linear-gradient(180deg,#eaf2ff 0%,#f2f4f6 min(320px,60vh))" }}
  >
    <div className="h-[60px] flex-none flex items-center justify-start px-[clamp(16px,5vw,24px)]">
      <span className="relative top-1 text-[clamp(20px,4.5vw,22px)] font-extrabold text-[#1f2937]">
        WORK-REPORT
      </span>
    </div>

    <div className="flex-1 flex flex-col px-[clamp(16px,5vw,24px)] py-[clamp(20px,6vw,36px)]">
      <div className="flex items-center gap-[clamp(12px,3.5vw,16px)] mb-[clamp(16px,4vw,20px)]">
        <div
          className="w-[clamp(64px,18vw,100px)] h-[clamp(64px,18vw,100px)] rounded-[22%] overflow-hidden flex-none"
          style={{ boxShadow: "0 10px 24px rgba(49,130,246,.28)" }}
        >
          <img src="/app-icon-1024.png" className="w-full h-full object-cover" alt="앱 아이콘" />
        </div>
        <div>
          <div className="text-left text-[clamp(18px,5vw,21px)] font-extrabold text-[#1f2937]">
            {formData.userName ? `${formData.userName}님, 안녕하세요` : "안녕하세요"}
          </div>
          <div className="text-left text-[clamp(13px,3.6vw,14px)] text-[#9ca3af] font-semibold mt-1.5">
            일자리 활동일지 관리
          </div>
        </div>
      </div>

      <div className="flex gap-[clamp(8px,3vw,12px)] mt-[clamp(28px,8vw,40px)]">
        <button
          onClick={onOpenAffiliation}
          className="flex-1 min-w-0 aspect-square bg-white border-[1.5px] border-[#eef0f3] rounded-[18px] px-[clamp(12px,4vw,16px)] py-[clamp(14px,4.5vw,18px)] flex flex-col items-start justify-center gap-3 cursor-pointer text-left shadow-[0_2px_8px_rgba(20,30,50,.05)]"
        >
          <img
            src="/icon-basic-info.png"
            className="w-[clamp(42px,10vw,80px)] h-[clamp(42px,10vw,80px)]"
            alt=""
          />
          <span className="text-[clamp(16px,4.4vw,18px)] font-extrabold text-[#1f2937]">
            기본정보 등록
          </span>
          <span className="text-[clamp(13px,3.5vw,14px)] text-[#9ca3af] font-semibold leading-[1.5]">
            사업단 배정 전,
            <br />
            가장 먼저 등록하기
          </span>
        </button>
        <button
          onClick={onStartActivityLog}
          className="flex-1 min-w-0 aspect-square bg-white border-[1.5px] border-[#eef0f3] rounded-[18px] px-[clamp(12px,4vw,16px)] py-[clamp(14px,4.5vw,18px)] flex flex-col items-start justify-center gap-3 cursor-pointer text-left shadow-[0_2px_8px_rgba(20,30,50,.05)]"
        >
          <img
            src="/icon-start-log.png"
            className="w-[clamp(42px,10vw,80px)] h-[clamp(42px,10vw,80px)]"
            alt=""
          />
          <span className="text-[clamp(16px,4.4vw,18px)] font-extrabold text-[#1f2937]">
            활동일지 시작하기
          </span>
          <span className="text-[clamp(13px,3.5vw,14px)] text-[#9ca3af] font-semibold leading-[1.5]">
            오늘의 출근부터,
            <br />
            차례로 기록하기
          </span>
        </button>
      </div>
      <div className="flex-1 min-h-[24px]" />
    </div>
  </div>
);

export default HomePage;

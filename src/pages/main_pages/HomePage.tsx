import type { ReactNode } from "react";
import { Building2 } from "lucide-react";

import type { ActivityLogFormData } from "../../types/form";
import { formatTimeField } from "../../utils/timeFormat";

interface HomePageProps {
  formData: ActivityLogFormData;
  onOpenAffiliation: () => void;
  onStartActivityLog: () => void;
}

interface HomeActionCardProps {
  onClick: () => void;
  iconSrc: string;
  title: string;
  description: ReactNode;
}

const WEEKDAY_LABEL = ["일", "월", "화", "수", "목", "금", "토"];

const todayLabel = () => {
  const now = new Date();
  return `${now.getMonth() + 1}월 ${now.getDate()}일 ${WEEKDAY_LABEL[now.getDay()]}요일`;
};

/**
 * 앱 메인 페이지
 */
const HomePage = ({ formData, onOpenAffiliation, onStartActivityLog }: HomePageProps) => {
  const clockInLabel = formatTimeField(formData.startTime);
  const isWorking = formData.startTime.hour !== "" && formData.endTime.hour === "";

  return (
    <div
      className="flex flex-col h-full min-h-0 flex-1 overflow-y-auto"
      style={{ background: "linear-gradient(180deg,#eaf2ff 0%,#f2f4f6 min(320px,60vh))" }}
    >
      <div className="h-[60px] flex items-center gap-2 px-[clamp(16px,5vw,24px)]">
        <span className="w-2 h-2 rounded-full bg-brand mb-[2px]" />
        <span className="leading-none text-[clamp(12px,3vw,13px)] font-extrabold tracking-[1.2px] text-text-tertiary">
          WORK REPORT
        </span>
      </div>

      <div className="flex-1 flex flex-col px-[clamp(16px,5vw,24px)] py-[clamp(12px,4vw,20px)]">
        <div className="mb-[clamp(20px,6vw,28px)]">
          <div className="text-left text-[clamp(19px,5.5vw,22px)] font-extrabold text-text-strong">
            {formData.userName ? `${formData.userName}님, 안녕하세요` : "안녕하세요"}
          </div>
          <div className="text-left text-[clamp(13px,3.6vw,14px)] text-text-muted font-semibold mt-1">
            오늘의 활동일지를 기록해볼까요?
          </div>
        </div>

        {formData.userName && (
          <div className="bg-white rounded-[20px] px-[clamp(16px,5vw,20px)] py-[clamp(16px,5vw,20px)] mb-[clamp(18px,5.5vw,24px)] shadow-[0_8px_20px_rgba(20,30,60,.06)]">
            <div className="flex items-start justify-between mb-[clamp(12px,4vw,16px)]">
              <div>
                <div className="text-[12.5px] font-semibold text-text-muted mb-1">오늘의 상태</div>
                <div className="text-[15px] font-bold text-text-strong">{todayLabel()}</div>
              </div>
              <div
                className={`flex items-center gap-1.5 text-[12px] font-bold px-3 py-1.5 rounded-full flex-none ${
                  isWorking ? "bg-brand-tint text-brand" : "bg-surface-page text-text-muted"
                }`}
              >
                <span
                  className={`w-[6px] h-[6px] rounded-full ${isWorking ? "bg-brand" : "bg-text-disabled"}`}
                />
                <p className="flex items-center text-center h-4 leading-5 mt-[2px]">
                  {isWorking ? "근무중" : "출근 전"}
                </p>
              </div>
            </div>

            {formData.programName && (
              <div className="flex items-center gap-1.5 mb-[clamp(14px,4.5vw,18px)]">
                <div className="w-[20px] h-[20px] rounded-[6px] bg-brand-tint flex items-center justify-center flex-none">
                  <Building2 className="w-[12px] h-[12px] text-brand" strokeWidth={2.2} />
                </div>
                <span className="text-[13.5px] font-bold text-text-tertiary">
                  {formData.programName}
                </span>
              </div>
            )}

            <div className="bg-brand-tint rounded-[14px] px-[clamp(12px,4vw,16px)] py-[clamp(11px,3.5vw,14px)]">
              <div className="text-[19px] font-extrabold text-brand">{clockInLabel || "-"}</div>
              <div className="text-[12px] text-text-muted font-medium mt-0.5">출근 시간</div>
            </div>
          </div>
        )}

        <div className="flex gap-[clamp(10px,3.5vw,14px)]">
          <HomeActionCard
            onClick={onOpenAffiliation}
            iconSrc="/icon-basic-info.png"
            title="기본정보 등록"
            description={
              <>
                사업단 배정 전,
                <br />
                가장 먼저 등록하기
              </>
            }
          />
          <HomeActionCard
            onClick={onStartActivityLog}
            iconSrc="/icon-start-log.png"
            title="활동일지 시작"
            description={
              <>
                오늘의 출근부터,
                <br />
                차례로 기록하기
              </>
            }
          />
        </div>
        <div className="flex-1 min-h-[24px]" />
      </div>
    </div>
  );
};

const HomeActionCard = ({ onClick, iconSrc, title, description }: HomeActionCardProps) => (
  <button
    onClick={onClick}
    className="flex-1 min-w-0 bg-white rounded-[20px] px-[clamp(14px,4.5vw,18px)] py-[clamp(18px,5.5vw,22px)] flex flex-col items-start text-left cursor-pointer shadow-[0_8px_20px_rgba(20,30,60,.06)]"
  >
    <img
      src={iconSrc}
      className="w-[clamp(42px,10vw,80px)] h-[clamp(42px,10vw,80px)] object-contain mb-[clamp(12px,4vw,18px)]"
      alt=""
    />
    <span className="text-[clamp(16px,4.4vw,18px)] font-extrabold text-text-strong leading-[1.25]">
      {title}
    </span>
    <span className="text-[clamp(12.5px,3.3vw,14px)] text-text-muted font-medium leading-[1.5] mt-2.5">
      {description}
    </span>
  </button>
);

export default HomePage;

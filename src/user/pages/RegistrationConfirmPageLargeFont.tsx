import type { ReactNode } from "react";

import { ChevronLeft } from "lucide-react";

import type { ActivityLogFormData } from "../../types/form";
import { programTypeShortLabel } from "../../types/form";
import ExceptionCard from "../components/atoms/ExceptionCard";

import type { ExceptionInfo } from "./RegistrationConfirmPage";

interface RegistrationConfirmPageLargeFontProps {
  formData: ActivityLogFormData;
  orgAddress: string | undefined;
  exception: ExceptionInfo | null | "loading";
  onBack: () => void;
  onNext: () => void;
}

const ConfirmRowLarge = ({ label, value }: { label: string; value: ReactNode }) => (
  <div className="flex items-center justify-between gap-4 py-5 border-b border-surface-page last:border-b-0">
    <span className="text-[18px] text-text-subtitle font-semibold flex-none">{label}</span>
    <span className="min-w-0 text-[20px] font-extrabold text-text-strong text-right">{value}</span>
  </div>
);

// 등록 확인 화면 큰글씨 버전 — 보통글씨 버전(RegistrationConfirmPage.tsx + AppBar 등
// 공용 컴포넌트)과 배경·카드·버튼 색/레이아웃은 완전히 동일하고 글자·아이콘·여백 크기만
// 설정 큰글씨 버전(SettingsPageLargeFont)과 같은 비율로 키운 스킨이다. 본인확인
// 조회/예외 판단 로직은 RegistrationConfirmPage가 그대로 소유하고 결과만 내려준다.
const RegistrationConfirmPageLargeFont = ({
  formData,
  orgAddress,
  exception,
  onBack,
  onNext,
}: RegistrationConfirmPageLargeFontProps) => (
  <div className="flex flex-col bg-surface-page h-full min-h-0 flex-1 overflow-y-auto">
    <div className="flex-none sticky top-0 z-10 flex items-center gap-2 px-[16px] py-[10px] bg-white border-b border-surface-page">
      <button
        onClick={onBack}
        className="w-[44px] h-[44px] rounded-xl bg-surface-page border-none flex items-center justify-center flex-none cursor-pointer"
        aria-label="이전으로"
      >
        <ChevronLeft size={22} color="#333d4b" strokeWidth={2.2} />
      </button>
      <span className="flex-1 text-center text-[20px] font-extrabold text-text-strong">
        등록 확인
      </span>
      <span className="w-[44px] flex-none" />
    </div>

    <div className="px-[16px] py-[20px] flex-1 flex flex-col gap-5">
      {exception !== "loading" && exception !== null && (
        <ExceptionCard
          variant={exception.variant}
          title={exception.title}
          body={exception.body}
          note={exception.note}
          isLargeFontMode
        />
      )}

      {(exception === "loading" || exception === null) && (
        <div className="bg-white border-[1.5px] border-border-faint rounded-[20px] p-6 shadow-[0_1px_2px_rgba(20,30,50,0.04)] flex items-center gap-5">
          <img src="/icons/icon-basic-info.png" alt="" className="w-14 h-14 flex-none" />
          <div className="min-w-0 flex-1">
            <div className="text-[clamp(18px,5.2vw,21px)] font-extrabold text-text-strong break-keep">
              등록 확인
            </div>
            <div className="text-[clamp(14px,4vw,17px)] text-text-subtitle font-semibold mt-1 break-keep">
              아래 내용이 맞는지 확인해주세요
            </div>
          </div>
        </div>
      )}

      {exception === "loading" && (
        <div className="bg-white border-[1.5px] border-border-faint rounded-[20px] p-[28px] shadow-[0_1px_2px_rgba(20,30,50,0.04)] flex flex-col gap-5">
          <p className="text-[20px] text-text-subtle">확인하는 중이에요...</p>
        </div>
      )}

      {exception === null && (
        <>
          <div className="bg-white border-[1.5px] border-border-faint rounded-[20px] px-6 shadow-[0_1px_2px_rgba(20,30,50,0.04)]">
            <ConfirmRowLarge
              label="소속 기관"
              value={
                orgAddress ? (
                  <>
                    {orgAddress}
                    <br />
                    {formData.orgName}
                  </>
                ) : (
                  formData.orgName
                )
              }
            />
            <ConfirmRowLarge
              label="사업단"
              value={
                <span className="flex flex-col items-end gap-1.5">
                  <span>{formData.programName}</span>
                  <span className="inline-flex text-[16px] font-extrabold px-3.5 py-1.5 rounded-full bg-brand-tint text-brand">
                    {programTypeShortLabel(formData.programType)}
                  </span>
                </span>
              }
            />
            <ConfirmRowLarge label="참여자" value={`${formData.userName} (${formData.gender})`} />
          </div>

          <p className="text-center text-[17px] text-text-subtitle font-semibold">
            내용이 맞으면 <b className="text-text-strong font-extrabold">다음</b>을,
            <br />
            틀리면 <b className="text-text-strong font-extrabold">이전</b>을 눌러주세요.
          </p>
        </>
      )}
    </div>

    <div className="flex-none bg-white px-[16px] pt-5 pb-6 flex flex-col gap-3.5 border-t border-surface-page">
      <div className="flex gap-3.5">
        <button
          onClick={onBack}
          className="flex-1 py-[18px] bg-white text-brand border-2 border-brand rounded-2xl text-[21px] font-extrabold font-sans cursor-pointer text-center"
        >
          이전
        </button>
        {exception === null && (
          <button
            onClick={onNext}
            className="flex-1 py-[18px] bg-brand text-white border-2 border-brand rounded-2xl text-[21px] font-extrabold font-sans cursor-pointer text-center"
          >
            다음
          </button>
        )}
      </div>
    </div>
  </div>
);

export default RegistrationConfirmPageLargeFont;

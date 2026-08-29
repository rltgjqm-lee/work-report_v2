import { useEffect } from "react";
import type { ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";

import type { ActivityLogFormData } from "../../types/form";
import { programTypeShortLabel } from "../../types/form";
import { getLocalToday } from "../../utils/timeFormat";

import Button from "../../components/atoms/Button";
import { bodyClass, pageClass } from "../../components/atoms/classes";

import { IdentifyError, identifyParticipantQueryOptions } from "../api/attendanceApi";
import BottomBar, { BottomBarRow } from "../components/atoms/BottomBar";
import Card from "../components/atoms/Card";
import ExceptionCard from "../components/atoms/ExceptionCard";
import AppBar from "../components/molecule/AppBar";
import PageHeaderCard from "../components/molecule/PageHeaderCard";
import { registerNativePush } from "../utils/nativePushRegistration";
import RegistrationConfirmPageLargeFont from "./RegistrationConfirmPageLargeFont";

export type ExceptionInfo = {
  variant: "warn" | "caution";
  title: string;
  body?: ReactNode;
  note: ReactNode;
};

const ConfirmRow = ({ label, value }: { label: string; value: ReactNode }) => (
  <div className="flex items-center justify-between gap-3.5 py-4 border-b border-surface-page last:border-b-0">
    <span className="text-[13.5px] text-text-muted font-semibold flex-none">{label}</span>
    <span className="text-[15px] font-extrabold text-text-strong text-right">{value}</span>
  </div>
);

/**
 * 등록 확인 페이지 입니다.
 * — 기본정보에서 입력한 내용을 요약해 보여주고,
 * - 참여자 상태(휴무/탈락)나 사업 기간(시작 전/종료됨)에 문제가 있으면 다음 단계로 넘어가지 못한다.
 */
const RegistrationConfirmPage = ({
  formData,
  onChange,
  onBack,
  onNext,
  isLargeFontMode,
}: {
  formData: ActivityLogFormData;
  onChange: <T extends keyof ActivityLogFormData>(key: T, value: ActivityLogFormData[T]) => void;
  onBack: () => void;
  onNext: () => void;
  isLargeFontMode: boolean;
}) => {
  const {
    data: identified,
    isPending: isIdentifyPending,
    isError: isIdentifyError,
    error: identifyError,
  } = useQuery(identifyParticipantQueryOptions(formData.programId, formData.userName));
  const participantId = identified?.participantId;
  const orgAddress = identified?.orgAddress;

  let exception: ExceptionInfo | null | "loading";

  useEffect(() => {
    if (!participantId || !formData.programId) return;

    onChange("participantId", participantId);
    registerNativePush(formData.programId, participantId);

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [participantId]);

  if (isIdentifyPending) {
    exception = "loading";
  } else if (isIdentifyError) {
    if (identifyError instanceof IdentifyError && identifyError.body.error === "NOT_REGISTERED") {
      const { organization, program } = identifyError.body;
      const regionLabel = [organization?.regionSido, organization?.regionSigungu]
        .filter(Boolean)
        .join(" ");
      const programLabel = [program.programType, program.name].filter(Boolean).join(" ");

      exception = {
        variant: "warn",
        title: "본인 확인에 실패했어요.",
        body: organization ? (
          <>
            {regionLabel} <strong className="text-brand font-extrabold">{organization.name}</strong>
            {"의"}
            <br />
            <strong className="text-brand font-extrabold">{programLabel}</strong> 사업에
            <br />
            등록이 안되어 있습니다.
          </>
        ) : (
          <>
            <strong className="text-brand font-extrabold">{programLabel}</strong> 사업에
            <br />
            등록이 안되어 있습니다.
          </>
        ),
        note: "해당 기관, 사업 담당자에게 문의하여 주세요.",
      };
    } else {
      exception = {
        variant: "warn",
        title: "본인 확인에 실패했어요.",
        note: "이름을 다시 확인해 주세요.\n해당 기관, 사업 담당자에게 문의하여 주세요.",
      };
    }
  } else if (identified.status === "DROPPED") {
    exception = {
      variant: "warn",
      title: "참여가 종료되었어요.",
      note: "해당 기관, 사업 담당자에게 문의하여 주세요.",
    };
  } else if (identified.status === "ON_LEAVE") {
    exception = {
      variant: "caution",
      title: "현재 휴무 중이에요.",
      note: identified.leaveEnd
        ? `${identified.leaveEnd}까지 휴무 예정이에요. 복귀 후 다시 이용해 주세요.`
        : "복귀 후 다시 이용해 주세요.",
    };
  } else if (identified.program) {
    const today = getLocalToday();

    if (identified.program.endDate < today) {
      exception = {
        variant: "caution",
        title: "사업이 종료되었어요.",
        note: "다른 사업에 참여하시려면 '이전'을 눌러 다시 선택해 주세요.",
      };
    } else if (identified.program.startDate > today) {
      exception = {
        variant: "caution",
        title: "아직 사업이 시작되지 않았어요.",
        note: `${identified.program.startDate}부터 이용하실 수 있어요.`,
      };
    } else {
      exception = null;
    }
  } else {
    exception = null;
  }

  if (isLargeFontMode) {
    return (
      <RegistrationConfirmPageLargeFont
        formData={formData}
        orgAddress={orgAddress}
        exception={exception}
        onBack={onBack}
        onNext={onNext}
      />
    );
  }

  return (
    <div className={pageClass}>
      <AppBar title="등록 확인" onBack={onBack} />
      <div className={bodyClass}>
        {exception !== "loading" && exception !== null && (
          <ExceptionCard
            variant={exception.variant}
            title={exception.title}
            body={exception.body}
            note={exception.note}
          />
        )}

        {(exception === "loading" || exception === null) && (
          <PageHeaderCard
            icon="/icons/icon-basic-info.png"
            title="등록 확인"
            subtitle="아래 내용이 맞는지 확인해주세요"
          />
        )}

        {exception === "loading" && (
          <Card>
            <p className="text-[15px] text-text-subtle">확인하는 중이에요...</p>
          </Card>
        )}

        {exception === null && (
          <>
            <div className="bg-white rounded-[20px] px-[18px] shadow-[0_1px_2px_rgba(20,30,50,0.04)]">
              <ConfirmRow
                label="소속 기관"
                value={orgAddress ? `${orgAddress} · ${formData.orgName}` : formData.orgName}
              />
              <ConfirmRow
                label="사업단"
                value={
                  <span className="inline-flex items-center gap-2">
                    <span>{formData.programName}</span>
                    <span className="inline-flex text-[12px] font-extrabold px-[10px] py-1 rounded-full bg-brand-tint text-brand">
                      {programTypeShortLabel(formData.programType)}
                    </span>
                  </span>
                }
              />
              <ConfirmRow label="참여자" value={`${formData.userName} (${formData.gender})`} />
            </div>

            <p className="text-center text-[13px] text-text-muted font-semibold">
              내용이 맞으면 <b className="text-text-strong font-extrabold">다음</b>을, 틀리면{" "}
              <b className="text-text-strong font-extrabold">이전</b>을 눌러주세요.
            </p>
          </>
        )}
      </div>

      <BottomBar>
        <BottomBarRow>
          <Button variant="outline" onClick={onBack}>
            이전
          </Button>
          {exception === null && (
            <Button variant="primary" className="flex-1" onClick={onNext}>
              다음
            </Button>
          )}
        </BottomBarRow>
      </BottomBar>
    </div>
  );
};

export default RegistrationConfirmPage;

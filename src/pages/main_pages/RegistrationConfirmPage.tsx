import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";

import AppBar from "../../components/molecule/AppBar";
import Card from "../../components/atoms/Card";
import ExceptionCard from "../../components/atoms/ExceptionCard";
import BottomBar, { BottomBarRow } from "../../components/atoms/BottomBar";
import Button from "../../components/atoms/Button";
import { pageClass, bodyClass } from "../../components/atoms/classes";
import { IdentifyError, identifyParticipantQueryOptions } from "../../utils/attendanceApi";
import { getLocalToday } from "../../utils/timeFormat";
import type { ActivityLogFormData } from "../../types/form";

type ExceptionInfo = {
  variant: "warn" | "caution";
  title: string;
  body: string;
};

/**
 * Page 2: 등록 확인 — 기본정보에서 입력한 내용을 요약해 보여주고, 참여자 상태(휴무/탈락)나
 * 사업 기간(시작 전/종료됨)에 문제가 있으면 다음 단계로 넘어가지 못하도록 안내한다.
 */
const RegistrationConfirmPage = ({
  formData,
  onChange,
  onBack,
  onNext,
}: {
  formData: ActivityLogFormData;
  onChange: <T extends keyof ActivityLogFormData>(key: T, value: ActivityLogFormData[T]) => void;
  onBack: () => void;
  onNext: () => void;
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
    if (!participantId) return;
    onChange("participantId", participantId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [participantId]);

  if (isIdentifyPending) {
    exception = "loading";
  } else if (isIdentifyError) {
    if (identifyError instanceof IdentifyError && identifyError.body.error === "NOT_REGISTERED") {
      const { organization, program } = identifyError.body;
      const organizationLabel = [
        organization?.regionSido,
        organization?.regionSigungu,
        organization?.name,
      ]
        .filter(Boolean)
        .join(" ");

      exception = {
        variant: "warn",
        title: "본인 확인에 실패했어요.",
        body: `${organizationLabel} ${program.programType ?? ""} ${program.name} 사업에 등록이 안되어 있습니다.
        \n해당 기관, 사업 담당자에게 문의하여 주세요.`,
      };
    } else {
      exception = {
        variant: "warn",
        title: "본인 확인에 실패했어요.",
        body: "이름을 다시 확인해 주세요. \n해당 기관, 사업 담당자에게 문의하여 주세요.",
      };
    }
  } else if (identified.status === "DROPPED") {
    exception = {
      variant: "warn",
      title: "참여가 종료되었어요.",
      body: "해당 기관, 사업 담당자에게 문의하여 주세요.",
    };
  } else if (identified.status === "ON_LEAVE") {
    exception = {
      variant: "caution",
      title: "현재 휴무 중이에요.",
      body: identified.leaveEnd
        ? `${identified.leaveEnd}까지 휴무 예정이에요. 복귀 후 다시 이용해 주세요.`
        : "복귀 후 다시 이용해 주세요.",
    };
  } else if (identified.program) {
    const today = getLocalToday();

    if (identified.program.endDate < today) {
      exception = {
        variant: "caution",
        title: "사업이 종료되었어요.",
        body: "다른 사업에 참여하시려면 '이전'을 눌러 다시 선택해 주세요.",
      };
    } else if (identified.program.startDate > today) {
      exception = {
        variant: "caution",
        title: "아직 사업이 시작되지 않았어요.",
        body: `${identified.program.startDate}부터 이용하실 수 있어요.`,
      };
    } else {
      exception = null;
    }
  } else {
    exception = null;
  }

  return (
    <div className={pageClass}>
      <AppBar title="등록 확인" onBack={onBack} />
      <div className={bodyClass}>
        {exception === "loading" && (
          <Card>
            <p className="text-[15px] text-[#6b7280]">확인하는 중이에요...</p>
          </Card>
        )}

        {exception && exception !== "loading" && (
          <ExceptionCard variant={exception.variant}>
            <strong>{exception.title}</strong>
            <br />
            <span className="whitespace-pre-line">{exception.body}</span>
          </ExceptionCard>
        )}

        {exception === null && (
          <Card>
            <p className="text-[16px] leading-relaxed font-medium text-[#1f2937]">
              {orgAddress && `${orgAddress} `}
              <strong className="text-[#3182f6] font-extrabold">{formData.orgName}</strong>의{" "}
              <strong className="text-[#3182f6] font-extrabold">{formData.programName}</strong>
              <br />
              <strong className="text-[#3182f6] font-extrabold">
                {formData.userName}({formData.gender})
              </strong>{" "}
              맞으신가요?
              <br />
              <br />
              맞으면 <strong className="font-extrabold">다음</strong>을, 틀리면{" "}
              <strong className="font-extrabold">이전</strong>을 눌러주세요.
            </p>
          </Card>
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

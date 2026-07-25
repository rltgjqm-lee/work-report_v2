import { useEffect, useState } from "react";

import AppBar from "../../components/molecule/AppBar";
import Card from "../../components/atoms/Card";
import ExceptionCard from "../../components/atoms/ExceptionCard";
import BottomBar, { BottomBarRow } from "../../components/atoms/BottomBar";
import Button from "../../components/atoms/Button";
import { pageClass, bodyClass } from "../../components/atoms/classes";
import { getAffiliations, getRegistrationStatus } from "../../utils/publicApi";
import { identifyParticipant } from "../../utils/attendanceApi";
import type { ActivityLogFormData } from "../../types/form";

type ExceptionInfo = {
  variant: "warn" | "caution";
  title: string;
  body: string;
};

const todayStr = () => new Date().toISOString().slice(0, 10);

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
  onChange: <T extends keyof ActivityLogFormData>(
    key: T,
    value: ActivityLogFormData[T],
  ) => void;
  onBack: () => void;
  onNext: () => void;
}) => {
  const [exception, setException] = useState<ExceptionInfo | null | "loading">(
    "loading",
  );

  useEffect(() => {
    if (!formData.programId || !formData.userName || !formData.phoneLast4) {
      return;
    }

    // 1단계: 이름+전화번호로 실제 참여자를 조회(본인확인)한다 — 동명이인 구분용.
    identifyParticipant(
      formData.programId,
      formData.userName,
      formData.phoneLast4,
    )
      .then((identified) => {
        onChange("participantId", identified.participantId);

        // 2단계: 조회된 participantId로 현재 상태(휴무/탈락)와 사업 기간을 확인한다.
        return Promise.all([
          getRegistrationStatus(identified.participantId),
          getAffiliations(),
        ]);
      })
      .then(([registrationStatus, { programs }]) => {
        if (registrationStatus.status === "DROPPED") {
          setException({
            variant: "warn",
            title: "참여가 종료되었어요.",
            body: "담당자에게 문의해 주세요.",
          });
          return;
        }
        if (registrationStatus.status === "ON_LEAVE") {
          setException({
            variant: "caution",
            title: "현재 휴무 중이에요.",
            body: registrationStatus.leaveEnd
              ? `${registrationStatus.leaveEnd}까지 휴무 예정이에요. 복귀 후 다시 이용해 주세요.`
              : "복귀 후 다시 이용해 주세요.",
          });
          return;
        }

        const program = programs.find((p) => p.id === formData.programId);
        const today = todayStr();

        if (program && program.endDate < today) {
          setException({
            variant: "caution",
            title: "사업이 종료되었어요.",
            body: "다른 사업에 참여하시려면 '이전'을 눌러 다시 선택해 주세요.",
          });
          return;
        }
        if (program && program.startDate > today) {
          setException({
            variant: "caution",
            title: "아직 사업이 시작되지 않았어요.",
            body: `${program.startDate}부터 이용하실 수 있어요.`,
          });
          return;
        }

        setException(null);
      })
      .catch((error) => {
        setException({
          variant: "warn",
          title: "본인 확인에 실패했어요.",
          body:
            error instanceof Error
              ? error.message
              : "이름과 전화번호를 다시 확인해 주세요.",
        });
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formData.programId, formData.userName, formData.phoneLast4]);

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
            <br />
            {exception.body}
          </ExceptionCard>
        )}

        {exception === null && (
          <Card>
            <p className="text-[16px] leading-relaxed font-medium text-[#1f2937]">
              <strong className="text-[#3182f6] font-extrabold">
                {formData.orgName}
              </strong>
              의{" "}
              <strong className="text-[#3182f6] font-extrabold">
                {formData.programName}
              </strong>{" "}
              사업이며,{" "}
              <strong className="text-[#3182f6] font-extrabold">
                {formData.userName}({formData.gender})
              </strong>
              님 이십니다.
              <br />
              <br />
              내용이 맞으면 '다음'을,
              <br />
              틀리면 '이전'을 눌러주세요.
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

import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { CircleCheck } from "lucide-react";

import { resolveEscapeMutationOptions } from "@work-report/admin-core/api/escapes";
import { mobileEscapeDetailQueryOptions } from "@work-report/admin-core/api/mobile";

import Card from "../components/atoms/Card";
import DetailHeader from "../components/molecule/DetailHeader";
import HeaderStats from "../components/molecule/HeaderStats";
import InfoRows from "../components/molecule/InfoRows";
import MemoField from "../components/molecule/MemoField";
import SafetyMap from "../components/organism/SafetyMap";
import {
  describeZonePosition,
  formatClock,
  formatDuration,
  formatMeters,
  useNow,
} from "../lib/format";

const ESCAPE_MEMO_PRESETS = ["통화로 안전 확인", "복귀 확인", "현장 출동", "보호자 연락"];

const EscapeDetailPage = () => {
  const now = useNow();
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();
  const escapeId = Number(searchParams.get("id"));
  const [memo, setMemo] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const {
    data: detail,
    isPending,
    isError,
    error,
  } = useQuery(mobileEscapeDetailQueryOptions(escapeId));
  const resolveEscapeMutation = useMutation(resolveEscapeMutationOptions(queryClient));

  if (isPending || isError || !detail) {
    return (
      <div className="flex min-h-full flex-col">
        <DetailHeader title="이탈 상세" fallbackPath="/safety?seg=escape" />
        <p
          className={`p-10 text-center text-sm font-bold ${isError ? "text-sos-ink" : "text-ink-muted"}`}
        >
          {isError
            ? error instanceof Error
              ? error.message
              : "불러오지 못했어요."
            : "불러오는 중..."}
        </p>
      </div>
    );
  }

  const { escape, areas } = detail;
  const isOpen = escape.status === "OPEN";
  const distance = isOpen
    ? (escape.currentOutsideM ?? escape.detectedOutsideM)
    : escape.detectedOutsideM;
  const durationMs =
    (isOpen || !escape.resolvedAt ? now.getTime() : new Date(escape.resolvedAt).getTime()) -
    new Date(escape.detectedAt).getTime();

  const handleResolveButtonClick = () => {
    setErrorMessage(null);
    resolveEscapeMutation.mutate(
      { escapeId: escape.id, programId: escape.programId, memo: memo.trim() || undefined },
      {
        onSuccess: () => setMemo(""),
        onError: (resolveError) =>
          setErrorMessage(
            resolveError instanceof Error ? resolveError.message : "처리하지 못했어요.",
          ),
      },
    );
  };

  return (
    <div className="flex min-h-full flex-col">
      <DetailHeader title="이탈 상세" fallbackPath="/safety?seg=escape">
        <div className="flex items-center gap-4">
          <span className="flex h-16 w-16 flex-none items-center justify-center rounded-[22px] bg-white/20 text-[26px] font-extrabold text-white">
            {escape.participantName.slice(0, 1)}
          </span>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="truncate text-[26px] font-extrabold text-white">
                {escape.participantName}
              </span>
              <span
                className={`flex-none rounded-full px-3 py-1 text-xs font-extrabold text-white ${
                  isOpen ? "bg-escape" : "bg-white/20"
                }`}
              >
                {isOpen ? "진행 중" : "처리됨"}
              </span>
            </div>
            <p className="mt-1.5 text-sm leading-normal font-semibold text-white/85">
              {[escape.programName, escape.groupName].filter(Boolean).join(" ")}
              <br />
              {escape.demandSiteName ?? "배정 수요처 없음"}
            </p>
          </div>
        </div>
        <HeaderStats
          stats={[
            { label: "이탈 시작", value: formatClock(escape.detectedAt, now) },
            { label: isOpen ? "현재 거리" : "이탈 거리", value: formatMeters(distance) },
            { label: isOpen ? "경과" : "처리까지", value: formatDuration(durationMs) },
          ]}
        />
      </DetailHeader>

      <div className="flex flex-1 flex-col gap-4 p-5">
        {!isOpen && (
          <div className="flex items-start gap-3 rounded-[18px] bg-ok-soft px-[18px] py-4">
            <CircleCheck size={36} className="flex-none text-ok" aria-hidden="true" />
            <span className="flex min-w-0 flex-col gap-1">
              <span className="text-base font-extrabold text-ok-deep">
                처리 완료 · {escape.resolverName ?? ""}{" "}
                {escape.resolvedAt ? formatClock(escape.resolvedAt, now) : ""}
              </span>
              <span className="text-sm leading-normal font-bold whitespace-pre-line text-ok-deep">
                {escape.memo || "메모 없음"}
              </span>
            </span>
          </div>
        )}

        <Card className="flex flex-col gap-3 p-3">
          <SafetyMap
            areas={areas}
            points={[
              {
                lat: escape.lat,
                lng: escape.lng,
                tone: isOpen ? "escape" : "muted",
                label: escape.participantName,
              },
            ]}
            ariaLabel={`관제 구역과 ${isOpen ? "현재" : "이탈"} 위치 — ${describeZonePosition(escape.demandSiteName, distance)}`}
          />
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 px-1.5 pb-1 text-[13px] font-bold text-ink-muted">
            <span className="flex items-center gap-1.5">
              <span
                className="h-3 w-3 rounded-full border-2 border-accent bg-accent/15"
                aria-hidden="true"
              />
              관제 구역
            </span>
            <span className="flex items-center gap-1.5">
              <span
                className={`h-3 w-3 rounded-full ${isOpen ? "bg-escape" : "bg-ink-faint"}`}
                aria-hidden="true"
              />
              {isOpen ? "마지막 보고 위치" : "이탈로 판정한 위치"}
            </span>
          </div>
        </Card>

        <InfoRows
          rows={[
            {
              label: isOpen ? "현재 위치" : "이탈 위치",
              value: describeZonePosition(escape.demandSiteName, distance),
            },
            ...(isOpen
              ? [
                  {
                    label: "마지막 위치 보고",
                    value: escape.lastLocationAt
                      ? formatClock(escape.lastLocationAt, now)
                      : "보고 없음",
                  },
                ]
              : []),
            { label: "판정 당시 거리", value: `경계에서 ${formatMeters(escape.detectedOutsideM)}` },
            { label: "알림 단계", value: `${escape.alertCount}단계` },
          ]}
        />

        {isOpen && (
          <MemoField
            id="escape-memo"
            value={memo}
            presets={ESCAPE_MEMO_PRESETS}
            onChange={setMemo}
          />
        )}
        {errorMessage && <p className="text-sm font-bold text-sos-ink">{errorMessage}</p>}
      </div>

      {isOpen && (
        <div className="sticky bottom-0 flex flex-none border-t-[1.5px] border-line bg-white px-5 pt-3 pb-5">
          <button
            type="button"
            onClick={handleResolveButtonClick}
            disabled={resolveEscapeMutation.isPending}
            className="h-14 flex-1 rounded-[18px] bg-accent text-[17px] font-extrabold text-white disabled:opacity-50"
          >
            {resolveEscapeMutation.isPending ? "처리 중..." : "처리 완료"}
          </button>
        </div>
      )}
    </div>
  );
};

export default EscapeDetailPage;

import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { CircleAlert, CircleCheck, Navigation } from "lucide-react";

import { mobileSosDetailQueryOptions } from "@work-report/admin-core/api/mobile";
import { resolveSosMutationOptions } from "@work-report/admin-core/api/sos";

import Card from "../components/atoms/Card";
import DetailHeader from "../components/molecule/DetailHeader";
import HeaderStats from "../components/molecule/HeaderStats";
import MemoField from "../components/molecule/MemoField";
import SafetyMap from "../components/organism/SafetyMap";
import {
  describeZonePosition,
  formatClock,
  formatElapsedSince,
  formatMeters,
  useNow,
} from "../lib/format";

const SOS_MEMO_PRESETS = ["통화로 안전 확인", "현장 출동", "보호자 인계", "버튼 오작동"];

const SosDetailPage = () => {
  const now = useNow();
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();
  const sosId = Number(searchParams.get("id"));
  const [memo, setMemo] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const { data: detail, isPending, isError, error } = useQuery(mobileSosDetailQueryOptions(sosId));
  const resolveSosMutation = useMutation(resolveSosMutationOptions(queryClient));

  if (isPending || isError || !detail) {
    return (
      <div className="flex min-h-full flex-col">
        <DetailHeader title="SOS 상세" fallbackPath="/safety" />
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

  const { sos, areas } = detail;
  const isOpen = sos.status === "OPEN";
  const hasPosition = sos.lat !== null && sos.lng !== null;

  const handleResolveButtonClick = () => {
    setErrorMessage(null);
    resolveSosMutation.mutate(
      { sosId: sos.id, programId: sos.programId, memo: memo.trim() || undefined },
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
      <DetailHeader title="SOS 상세" fallbackPath="/safety">
        <div className="flex items-center gap-4">
          <span className="flex h-16 w-16 flex-none items-center justify-center rounded-[22px] bg-white/20 text-[26px] font-extrabold text-white">
            {sos.participantName.slice(0, 1)}
          </span>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="truncate text-[26px] font-extrabold text-white">
                {sos.participantName}
              </span>
              <span
                className={`flex-none rounded-full px-3 py-1 text-xs font-extrabold text-white ${
                  isOpen ? "bg-sos" : "bg-white/20"
                }`}
              >
                {isOpen ? "미처리" : "처리됨"}
              </span>
            </div>
            <p className="mt-1.5 text-sm leading-normal font-semibold text-white/85">
              {[sos.programName, sos.groupName].filter(Boolean).join(" ")}
              <br />
              {sos.demandSiteName ?? "배정 수요처 없음"}
            </p>
          </div>
        </div>
        <HeaderStats
          stats={[
            { label: "요청 시각", value: formatClock(sos.triggeredAt, now) },
            isOpen
              ? { label: "경과", value: formatElapsedSince(sos.triggeredAt, now) }
              : {
                  label: "처리 시각",
                  value: sos.resolvedAt ? formatClock(sos.resolvedAt, now) : "–",
                },
            {
              label: "관제 구역",
              value:
                sos.outsideM === null
                  ? "모름"
                  : sos.outsideM === 0
                    ? "안"
                    : `밖 ${formatMeters(sos.outsideM)}`,
            },
          ]}
        />
      </DetailHeader>

      <div className="flex flex-1 flex-col gap-4 p-5">
        {isOpen ? (
          <div className="flex items-center gap-3 rounded-[18px] bg-sos-soft px-[18px] py-4">
            <CircleAlert size={36} className="flex-none text-sos" aria-hidden="true" />
            <span className="flex min-w-0 flex-col gap-0.5">
              <span className="text-base font-extrabold text-sos-deep">
                {formatElapsedSince(sos.triggeredAt, now)}째 처리되지 않았어요
              </span>
              <span className="text-[13px] font-bold text-sos-ink">
                참여자 상태를 먼저 확인해주세요
              </span>
            </span>
          </div>
        ) : (
          <div className="flex items-start gap-3 rounded-[18px] bg-ok-soft px-[18px] py-4">
            <CircleCheck size={36} className="flex-none text-ok" aria-hidden="true" />
            <span className="flex min-w-0 flex-col gap-1">
              <span className="text-base font-extrabold text-ok-deep">
                처리 완료 · {sos.resolverName ?? ""}{" "}
                {sos.resolvedAt ? formatClock(sos.resolvedAt, now) : ""}
              </span>
              <span className="text-sm leading-normal font-bold whitespace-pre-line text-ok-deep">
                {sos.memo || "메모 없음"}
              </span>
            </span>
          </div>
        )}

        <Card className="flex flex-col gap-3 p-3">
          {hasPosition ? (
            <SafetyMap
              areas={areas}
              points={[
                {
                  lat: sos.lat as number,
                  lng: sos.lng as number,
                  tone: "sos",
                  label: sos.participantName,
                },
              ]}
              ariaLabel={`SOS 요청 위치 지도 — ${describeZonePosition(sos.demandSiteName, sos.outsideM)}`}
            />
          ) : (
            <p className="rounded-[14px] bg-soft px-4 py-6 text-center text-sm font-bold text-ink-muted">
              SOS를 누른 순간의 위치 정보가 없어요
            </p>
          )}
          <div className="flex items-center gap-3 px-1.5 pb-1">
            <span className="flex min-w-0 flex-1 flex-col gap-0.5">
              <span className="text-[15px] font-extrabold text-ink">
                {describeZonePosition(sos.demandSiteName, sos.outsideM)}
              </span>
              {hasPosition && (
                <span className="text-[13px] font-bold text-ink-muted">
                  SOS를 누르기 전 마지막으로 보고된 위치예요
                </span>
              )}
            </span>
            {hasPosition && (
              <a
                href={`geo:${sos.lat},${sos.lng}?q=${sos.lat},${sos.lng}(${encodeURIComponent(sos.participantName)})`}
                className="flex flex-none items-center gap-1 rounded-xl bg-accent/10 px-3 py-2 text-[13px] font-extrabold text-accent"
              >
                <Navigation size={14} aria-hidden="true" />
                길찾기
              </a>
            )}
          </div>
        </Card>

        {isOpen && (
          <MemoField id="sos-memo" value={memo} presets={SOS_MEMO_PRESETS} onChange={setMemo} />
        )}
        {errorMessage && <p className="text-sm font-bold text-sos-ink">{errorMessage}</p>}
      </div>

      {isOpen && (
        <div className="sticky bottom-0 flex flex-none border-t-[1.5px] border-line bg-white px-5 pt-3 pb-5">
          <button
            type="button"
            onClick={handleResolveButtonClick}
            disabled={resolveSosMutation.isPending}
            className="h-14 flex-1 rounded-[18px] bg-accent text-[17px] font-extrabold text-white disabled:opacity-50"
          >
            {resolveSosMutation.isPending ? "처리 중..." : "처리 완료"}
          </button>
        </div>
      )}
    </div>
  );
};

export default SosDetailPage;

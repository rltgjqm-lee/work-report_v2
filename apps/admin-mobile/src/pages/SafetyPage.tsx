import { Link, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";

import { MapPin } from "lucide-react";

import { mobileSafetyQueryOptions } from "@work-report/admin-core/api/mobile";
import type { MobileEscape, MobileSos } from "@work-report/admin-core/api/mobile";

import StatusChip from "../components/atoms/StatusChip";
import {
  formatClock,
  formatDuration,
  formatElapsedSince,
  formatMeters,
  useNow,
  zoneBadgeText,
} from "../lib/format";

type Segment = "sos" | "escape";
type ListView = "open" | "resolved";

const SEGMENT_BUTTON_BASE =
  "flex h-11 flex-1 items-center justify-center gap-2 rounded-xl text-base font-extrabold";
const VIEW_BUTTON_BASE = "h-11 flex-1 rounded-[14px] text-[15px] font-extrabold";

const teamText = (item: { programName: string; groupName: string | null }) =>
  [item.programName, item.groupName].filter(Boolean).join(" ");

const SosCard = ({ sos, now }: { sos: MobileSos; now: Date }) => {
  const isOpen = sos.status === "OPEN";
  return (
    <Link
      to={`/sos?id=${sos.id}`}
      className="flex flex-col gap-3 rounded-[18px] bg-white px-[18px] py-4 shadow-[0_2px_8px_rgba(20,30,50,.05)]"
    >
      <div className="flex items-start gap-3">
        <span
          className={`flex h-11 w-11 flex-none items-center justify-center rounded-[15px] text-xs font-black ${
            isOpen ? "bg-sos text-white" : "bg-page text-ink-sub"
          }`}
        >
          SOS
        </span>
        <span className="flex min-w-0 flex-1 flex-col gap-1">
          <span className="flex items-center gap-2">
            <span className="truncate text-[17px] font-extrabold text-ink">
              {sos.participantName}
            </span>
            <StatusChip tone={isOpen ? "sos" : "ok"}>{isOpen ? "미처리" : "처리됨"}</StatusChip>
          </span>
          <span className="text-[13px] leading-normal font-semibold text-ink-muted">
            {teamText(sos)}
            {sos.demandSiteName && ` · ${sos.demandSiteName}`}
          </span>
        </span>
        <span className="flex-none text-[13px] font-bold text-ink-muted">
          {isOpen
            ? `${formatElapsedSince(sos.triggeredAt, now)} 전`
            : formatClock(sos.triggeredAt, now)}
        </span>
      </div>
      <div className="flex items-center gap-2 rounded-xl bg-soft px-3 py-2.5">
        <MapPin size={15} className="flex-none text-ink-sub" aria-hidden="true" />
        <span className="min-w-0 flex-1 truncate text-[13px] font-bold text-ink-sub">
          {sos.demandSiteName ?? "배정 수요처 없음"}
        </span>
        <span
          className={`flex-none text-xs font-extrabold ${
            sos.outsideM === 0
              ? "text-ok-ink"
              : sos.outsideM === null
                ? "text-ink-muted"
                : "text-sos-ink"
          }`}
        >
          {zoneBadgeText(sos.outsideM)}
        </span>
      </div>
      <div className="flex items-center justify-between gap-2.5 border-t-[1.5px] border-page pt-3">
        <span className={`text-[13px] font-extrabold ${isOpen ? "text-sos-ink" : "text-ok-ink"}`}>
          {isOpen
            ? `${formatElapsedSince(sos.triggeredAt, now)}째 미처리`
            : `처리 완료 · ${sos.resolverName ?? ""} ${sos.resolvedAt ? formatClock(sos.resolvedAt, now) : ""}`}
        </span>
        <span className="flex-none text-[13px] font-extrabold text-accent">상세 보기 ›</span>
      </div>
    </Link>
  );
};

const EscapeCard = ({ escape, now }: { escape: MobileEscape; now: Date }) => {
  const isOpen = escape.status === "OPEN";
  const distance = isOpen
    ? (escape.currentOutsideM ?? escape.detectedOutsideM)
    : escape.detectedOutsideM;
  const durationMs =
    (isOpen || !escape.resolvedAt ? now.getTime() : new Date(escape.resolvedAt).getTime()) -
    new Date(escape.detectedAt).getTime();
  return (
    <Link
      to={`/escape?id=${escape.id}`}
      className="flex flex-col gap-3 rounded-[18px] bg-white px-[18px] py-4 shadow-[0_2px_8px_rgba(20,30,50,.05)]"
    >
      <div className="flex items-start gap-3">
        <span
          className={`flex h-11 w-11 flex-none items-center justify-center rounded-[15px] text-[13px] font-black ${
            isOpen ? "bg-escape text-white" : "bg-page text-ink-sub"
          }`}
        >
          이탈
        </span>
        <span className="flex min-w-0 flex-1 flex-col gap-1">
          <span className="flex items-center gap-2">
            <span className="truncate text-[17px] font-extrabold text-ink">
              {escape.participantName}
            </span>
            <StatusChip tone={isOpen ? "escape" : "ok"}>{isOpen ? "진행 중" : "처리됨"}</StatusChip>
          </span>
          <span className="text-[13px] leading-normal font-semibold text-ink-muted">
            {teamText(escape)}
            {escape.demandSiteName && ` · ${escape.demandSiteName}`}
          </span>
        </span>
      </div>
      <div className="flex gap-2">
        {[
          { label: "이탈 시작", value: formatClock(escape.detectedAt, now), highlight: false },
          {
            label: isOpen ? "현재 거리" : "이탈 거리",
            value: formatMeters(distance),
            highlight: isOpen,
          },
          {
            label: isOpen ? "경과" : "처리까지",
            value: formatDuration(durationMs),
            highlight: false,
          },
        ].map((stat) => (
          <span
            key={stat.label}
            className="flex min-w-0 flex-1 flex-col gap-0.5 rounded-xl bg-soft px-3 py-2.5"
          >
            <span className="text-[11px] font-bold text-ink-muted">{stat.label}</span>
            <span
              className={`text-[15px] leading-snug font-extrabold break-words ${stat.highlight ? "text-escape-ink" : "text-ink"}`}
            >
              {stat.value}
            </span>
          </span>
        ))}
      </div>
      <div className="flex items-center justify-between gap-2.5 border-t-[1.5px] border-page pt-3">
        <span
          className={`min-w-0 truncate text-[13px] font-extrabold ${isOpen ? "text-ink-sub" : "text-ok-ink"}`}
        >
          {isOpen
            ? escape.currentOutsideM === 0
              ? "구역 안으로 돌아왔어요"
              : "아직 구역 밖이에요"
            : `처리 완료 · ${escape.resolverName ?? ""} ${escape.resolvedAt ? formatClock(escape.resolvedAt, now) : ""}`}
        </span>
        <span className="flex-none text-[13px] font-extrabold text-accent">상세 보기 ›</span>
      </div>
    </Link>
  );
};

const SafetyPage = () => {
  const now = useNow();
  const [searchParams, setSearchParams] = useSearchParams();
  const segment: Segment = searchParams.get("seg") === "escape" ? "escape" : "sos";
  const view: ListView = searchParams.get("view") === "resolved" ? "resolved" : "open";
  const { data: safety, isPending, isError, error } = useQuery(mobileSafetyQueryOptions);

  const sosList = safety?.sos ?? [];
  const escapes = safety?.escapes ?? [];
  const openSosCount = sosList.filter((sos) => sos.status === "OPEN").length;
  const openEscapeCount = escapes.filter((escape) => escape.status === "OPEN").length;
  const resolvedSosCount = sosList.length - openSosCount;
  const resolvedEscapeCount = escapes.length - openEscapeCount;

  const changeFilter = (next: { seg?: Segment; view?: ListView }) => {
    setSearchParams({ seg: next.seg ?? segment, view: next.view ?? view }, { replace: true });
  };

  const visibleSosList = sosList.filter((sos) => (view === "open") === (sos.status === "OPEN"));
  const visibleEscapes = escapes.filter(
    (escape) => (view === "open") === (escape.status === "OPEN"),
  );
  const isEmpty = segment === "sos" ? visibleSosList.length === 0 : visibleEscapes.length === 0;

  return (
    <div className="flex min-h-full flex-col">
      <header className="flex flex-none flex-col gap-[18px] bg-accent px-5 pt-[22px] pb-5">
        <div>
          <p className="text-[15px] font-extrabold text-white/85">안전 관제</p>
          <h1 className="mt-1.5 text-[26px] font-extrabold text-white">
            확인이 필요한 건 {openSosCount + openEscapeCount}건
          </h1>
          <p className="mt-1.5 text-sm font-semibold text-white/85">
            SOS 미처리 {openSosCount} · 이탈 진행 중 {openEscapeCount}
          </p>
        </div>
        <div className="flex gap-1 rounded-2xl bg-white/15 p-1">
          {(
            [
              ["sos", "SOS", openSosCount],
              ["escape", "이탈", openEscapeCount],
            ] as const
          ).map(([id, label, count]) => {
            const isSelected = segment === id;
            return (
              <button
                key={id}
                type="button"
                aria-pressed={isSelected}
                onClick={() => changeFilter({ seg: id })}
                className={`${SEGMENT_BUTTON_BASE} ${isSelected ? "bg-white text-accent" : "text-white"}`}
              >
                {label}
                <span
                  className={`inline-flex h-[22px] min-w-[22px] items-center justify-center rounded-full px-1.5 text-xs ${
                    count > 0
                      ? id === "sos"
                        ? "bg-sos text-white"
                        : "bg-escape text-white"
                      : isSelected
                        ? "bg-accent-pale text-accent"
                        : "bg-white/20 text-white"
                  }`}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      </header>

      <div className="flex flex-none gap-1.5 border-b-[1.5px] border-line bg-white px-4 py-2.5">
        {(
          [
            ["open", segment === "sos" ? `미처리 ${openSosCount}` : `진행 중 ${openEscapeCount}`],
            ["resolved", `처리됨 ${segment === "sos" ? resolvedSosCount : resolvedEscapeCount}`],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            aria-pressed={view === id}
            onClick={() => changeFilter({ view: id })}
            className={`${VIEW_BUTTON_BASE} ${view === id ? "bg-accent text-white" : "bg-soft text-ink-sub"}`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="flex flex-1 flex-col gap-3 p-5">
        {isPending && (
          <p className="py-10 text-center text-sm font-bold text-ink-muted">불러오는 중...</p>
        )}
        {isError && (
          <p className="py-10 text-center text-sm font-bold text-sos-ink">
            {error instanceof Error ? error.message : "불러오지 못했어요."}
          </p>
        )}
        {safety && isEmpty && (
          <p className="py-10 text-center text-sm font-bold text-ink-muted">
            {view === "open"
              ? segment === "sos"
                ? "처리할 SOS가 없어요"
                : "진행 중인 이탈이 없어요"
              : "최근 7일 동안 처리한 건이 없어요"}
          </p>
        )}
        {segment === "sos"
          ? visibleSosList.map((sos) => <SosCard key={sos.id} sos={sos} now={now} />)
          : visibleEscapes.map((escape) => (
              <EscapeCard key={escape.id} escape={escape} now={now} />
            ))}
      </div>
    </div>
  );
};

export default SafetyPage;

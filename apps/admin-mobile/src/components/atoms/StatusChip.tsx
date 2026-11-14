export type ChipTone = "sos" | "escape" | "ok" | "muted";

const TONE_CLASSES: Record<ChipTone, string> = {
  sos: "bg-sos-soft text-sos-ink",
  escape: "bg-escape-soft text-escape-ink",
  ok: "bg-ok-soft text-ok-ink",
  muted: "bg-page text-ink-sub",
};

type StatusChipProps = {
  tone: ChipTone;
  children: string;
};

const StatusChip = ({ tone, children }: StatusChipProps) => (
  <span
    className={`flex-none rounded-full px-2.5 py-1 text-[11px] font-extrabold ${TONE_CLASSES[tone]}`}
  >
    {children}
  </span>
);

export default StatusChip;

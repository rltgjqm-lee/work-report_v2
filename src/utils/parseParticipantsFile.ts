export type ParsedParticipantRow = {
  name: string;
  demandName?: string;
  phoneLast4: string;
  groupId?: number;
};

type GroupOption = { id: number; name: string };

const toText = (value: unknown): string => {
  if (value === null || value === undefined) return "";
  if (typeof value === "object") {
    const v = value as {
      text?: unknown;
      richText?: { text: string }[];
      result?: unknown;
    };
    if (Array.isArray(v.richText)) {
      return v.richText
        .map((r) => r.text)
        .join("")
        .trim();
    }
    if ("text" in v) return String(v.text ?? "").trim();
    if ("result" in v) return String(v.result ?? "").trim();
  }
  return String(value).trim();
};

const toPhoneLast4 = (value: unknown): string => {
  const text = toText(value);
  if (!text) return "";
  return /^\d+$/.test(text) ? text.padStart(4, "0") : text;
};

const resolveGroupId = (
  groupName: string,
  groups: GroupOption[],
): number | undefined => groups.find((group) => group.name === groupName)?.id;

const parseXlsx = async (
  file: File,
  groups: GroupOption[],
): Promise<ParsedParticipantRow[]> => {
  const ExcelJS = (await import("exceljs")).default;
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(await file.arrayBuffer());

  const worksheet = workbook.worksheets[0];
  const rows: ParsedParticipantRow[] = [];

  // 1행: 헤더, 2행: 주의사항 (downloadAddParticipantsTemplate 양식과 동일한 구조) → 3행부터 데이터
  for (let rowNumber = 3; rowNumber <= worksheet.rowCount; rowNumber++) {
    const row = worksheet.getRow(rowNumber);
    const name = toText(row.getCell(2).value);
    if (!name) continue;

    const groupName = toText(row.getCell(5).value);

    rows.push({
      name,
      demandName: toText(row.getCell(3).value) || undefined,
      phoneLast4: toPhoneLast4(row.getCell(4).value),
      groupId: groupName ? resolveGroupId(groupName, groups) : undefined,
    });
  }

  return rows;
};

const parseCsv = async (
  file: File,
  groups: GroupOption[],
): Promise<ParsedParticipantRow[]> => {
  const text = await file.text();
  const lines = text.split(/\r?\n/).filter((line) => line.trim() !== "");
  const rows: ParsedParticipantRow[] = [];

  for (const line of lines) {
    const cells = line.split(",").map((cell) => cell.trim());
    const [, name, demandName, phone, groupName] = cells;
    if (!name || name === "이름") continue;

    rows.push({
      name,
      demandName: demandName || undefined,
      phoneLast4: toPhoneLast4(phone),
      groupId: groupName ? resolveGroupId(groupName, groups) : undefined,
    });
  }

  return rows;
};

export const parseParticipantsFile = (
  file: File,
  groups: GroupOption[] = [],
): Promise<ParsedParticipantRow[]> => {
  const isCsv = file.name.toLowerCase().endsWith(".csv");
  return isCsv ? parseCsv(file, groups) : parseXlsx(file, groups);
};

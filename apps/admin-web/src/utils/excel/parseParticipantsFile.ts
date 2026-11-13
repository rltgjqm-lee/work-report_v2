export type ParsedParticipantRow = {
  name: string;
  gender?: "남성" | "여성";
  demandSiteId?: number;
  groupId?: number;
};

const parseGender = (value: string): "남성" | "여성" | undefined =>
  value === "남성" || value === "여성" ? value : undefined;

type GroupOption = { id: number; name: string };
type DemandSiteOption = { id: number; name: string };

const toText = (value: unknown): string => {
  if (value === null || value === undefined) return "";
  if (typeof value === "object") {
    const cellValue = value as {
      text?: unknown;
      richText?: { text: string }[];
      result?: unknown;
    };
    if (Array.isArray(cellValue.richText)) {
      return cellValue.richText
        .map((richTextSegment) => richTextSegment.text)
        .join("")
        .trim();
    }
    if ("text" in cellValue) return String(cellValue.text ?? "").trim();
    if ("result" in cellValue) return String(cellValue.result ?? "").trim();
  }
  return String(value).trim();
};

const resolveGroupId = (groupName: string, groups: GroupOption[]): number | undefined =>
  groups.find((group) => group.name === groupName)?.id;

const resolveDemandSiteId = (
  demandSiteName: string,
  demandSites: DemandSiteOption[],
): number | undefined => demandSites.find((demandSite) => demandSite.name === demandSiteName)?.id;

const parseXlsx = async (
  file: File,
  groups: GroupOption[],
  demandSites: DemandSiteOption[],
): Promise<ParsedParticipantRow[]> => {
  const ExcelJS = (await import("exceljs")).default;
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(await file.arrayBuffer());

  const worksheet = workbook.worksheets[0];
  const rows: ParsedParticipantRow[] = [];

  // 1행: 헤더, 2행: 주의사항 (downloadAddParticipantsTemplate 양식과 동일한 구조) → 3행부터 데이터
  // 열 순서: 순번(1), 이름(2), 수요처(3), 조(4), 성별(5)
  for (let rowNumber = 3; rowNumber <= worksheet.rowCount; rowNumber++) {
    const row = worksheet.getRow(rowNumber);
    const name = toText(row.getCell(2).value);
    if (!name) continue;

    const demandSiteName = toText(row.getCell(3).value);
    const groupName = toText(row.getCell(4).value);
    const genderText = toText(row.getCell(5).value);

    rows.push({
      name,
      gender: genderText ? parseGender(genderText) : undefined,
      demandSiteId: demandSiteName ? resolveDemandSiteId(demandSiteName, demandSites) : undefined,
      groupId: groupName ? resolveGroupId(groupName, groups) : undefined,
    });
  }

  return rows;
};

export const parseParticipantsFile = (
  file: File,
  groups: GroupOption[] = [],
  demandSites: DemandSiteOption[] = [],
): Promise<ParsedParticipantRow[]> => parseXlsx(file, groups, demandSites);

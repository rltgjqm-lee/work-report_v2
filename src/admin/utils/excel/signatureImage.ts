import type { Anchor } from "exceljs";

// 엑셀 양식의 서명 칸에 서명 이미지를 꽉 차게 넣기 위한 도우미.
// 앱에서 받은 서명은 캔버스 전체(빈 여백 포함)라 그대로 칸에 맞추면 글씨가 작게 보인다 —
// 브라우저에서 획이 있는 부분만 잘라낸 뒤, 칸 크기에 비율을 유지하며 맞춘다.

const INK_ALPHA_MIN = 16;
const INK_LUMINANCE_MAX = 200;
const TRIM_PADDING_PX = 4;

const loadImage = (dataUrl: string) =>
  new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = dataUrl;
  });

/**
 * 서명 data URL에서 획이 있는 영역만 남기고 여백을 잘라낸 PNG data URL을 돌려준다.
 * 이미지를 못 읽거나 획이 없으면 원본을 그대로 돌려준다.
 */
export const trimSignatureDataUrl = async (dataUrl: string): Promise<string> => {
  if (!dataUrl.startsWith("data:image/")) return dataUrl;
  try {
    const image = await loadImage(dataUrl);
    const canvas = document.createElement("canvas");
    canvas.width = image.naturalWidth;
    canvas.height = image.naturalHeight;
    const context = canvas.getContext("2d");
    if (!context) return dataUrl;
    context.drawImage(image, 0, 0);
    const { data, width, height } = context.getImageData(0, 0, canvas.width, canvas.height);

    let minX = width;
    let minY = height;
    let maxX = -1;
    let maxY = -1;
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const offset = (y * width + x) * 4;
        const alpha = data[offset + 3];
        const luminance = (data[offset] + data[offset + 1] + data[offset + 2]) / 3;
        if (alpha >= INK_ALPHA_MIN && luminance <= INK_LUMINANCE_MAX) {
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
        }
      }
    }
    if (maxX < 0) return dataUrl;

    const left = Math.max(0, minX - TRIM_PADDING_PX);
    const top = Math.max(0, minY - TRIM_PADDING_PX);
    const right = Math.min(width, maxX + 1 + TRIM_PADDING_PX);
    const bottom = Math.min(height, maxY + 1 + TRIM_PADDING_PX);
    const trimmed = document.createElement("canvas");
    trimmed.width = right - left;
    trimmed.height = bottom - top;
    trimmed
      .getContext("2d")
      ?.drawImage(
        canvas,
        left,
        top,
        trimmed.width,
        trimmed.height,
        0,
        0,
        trimmed.width,
        trimmed.height,
      );
    return trimmed.toDataURL("image/png");
  } catch {
    return dataUrl;
  }
};

// PNG 헤더(IHDR)에서 가로·세로 픽셀 크기를 읽는다 — 이미지를 디코딩하지 않고 비율만 알면 된다.
const readPngSize = (dataUrl: string): { width: number; height: number } | null => {
  const base64 = dataUrl.includes(",") ? dataUrl.split(",")[1] : dataUrl;
  try {
    const header = atob(base64.slice(0, 44));
    if (header.slice(1, 4) !== "PNG") return null;
    const readUint32 = (offset: number) =>
      ((header.charCodeAt(offset) << 24) |
        (header.charCodeAt(offset + 1) << 16) |
        (header.charCodeAt(offset + 2) << 8) |
        header.charCodeAt(offset + 3)) >>>
      0;
    return { width: readUint32(16), height: readUint32(20) };
  } catch {
    return null;
  }
};

// 엑셀 열 너비(문자 수)·행 높이(pt)를 화면 픽셀로 환산 — ExcelJS 이미지 크기(ext)는 픽셀 단위다
export const columnWidthToPx = (width: number) => Math.round(width * 7 + 5);
export const rowHeightToPx = (heightPt: number) => Math.round((heightPt * 4) / 3);

// 엑셀 그림 위치의 단위(EMU) — 화면 1px = 9525 EMU
const EMU_PER_PX = 9525;

/**
 * 서명 이미지를 칸(col, row, 칸 크기 px) 안에 비율을 유지하며 최대한 크게, 가운데에 놓을
 * 범위를 계산한다. 크기를 못 읽으면 칸에 꽉 채운다.
 *
 * 위치는 칸 안 좌표(EMU)로 네 모서리를 직접 지정한다(twoCellAnchor). ExcelJS에 소수 열·행
 * (col: 8.04처럼)으로 주면 열 너비를 엉뚱한 단위로 환산해 오프셋이 1/9 수준으로 줄어 서명이 칸
 * 왼쪽 위에 붙고, 시작점+크기(ext)만 주면 일부 프로그램(맥 Numbers 등)이 크기를 무시해 작게 보였다.
 */
export const fitSignatureInCell = (
  dataUrl: string,
  {
    col,
    row,
    cellWidthPx,
    cellHeightPx,
  }: { col: number; row: number; cellWidthPx: number; cellHeightPx: number },
  paddingPx = 3,
) => {
  const boxWidth = cellWidthPx - paddingPx * 2;
  const boxHeight = cellHeightPx - paddingPx * 2;
  const size = readPngSize(dataUrl);
  const scale = size ? Math.min(boxWidth / size.width, boxHeight / size.height) : 1;
  const width = size ? Math.round(size.width * scale) : boxWidth;
  const height = size ? Math.round(size.height * scale) : boxHeight;
  const left = Math.round((cellWidthPx - width) / 2);
  const top = Math.round((cellHeightPx - height) / 2);

  const anchorAt = (offsetX: number, offsetY: number) =>
    ({
      nativeCol: col,
      nativeColOff: offsetX * EMU_PER_PX,
      nativeRow: row,
      nativeRowOff: offsetY * EMU_PER_PX,
    }) as unknown as Anchor;

  return {
    tl: anchorAt(left, top),
    br: anchorAt(left + width, top + height),
    editAs: "oneCell",
  };
};

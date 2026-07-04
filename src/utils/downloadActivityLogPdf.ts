import html2pdf from "html2pdf.js";

interface ExportPdfArgs {
  element: HTMLElement;
  fileName: string;
}

export const downloadActivityLogPdf = async ({
  element,
  fileName,
}: ExportPdfArgs): Promise<void> => {
  const opt = {
    margin: 10,
    filename: fileName,
    image: { type: "jpeg", quality: 0.98 },
    html2canvas: { scale: 2, useCORS: true, scrollY: 0 },
    jsPDF: { unit: "mm", format: "a4", orientation: "landscape" },
  } as const;

  // 피사체(element)를 그대로 타겟팅하여 PDF 파일 빌드 및 다운로드
  await html2pdf().set(opt).from(element).save();
};

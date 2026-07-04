import React from "react";
import type { ActivityLogFormData, ActivityLogItem } from "../../types/form";

interface PdfTemplateProps {
  printRef: React.RefObject<HTMLDivElement | null>;
  formData: ActivityLogFormData;
  filteredLogs: ActivityLogItem[];
}

const pdfTableStyle = `
  .pdf-table {
    width: 100%;
    border-collapse: collapse;
    border: 2px solid black;
    text-align: center;
    font-size: 14px;
    color: black;
  }
  .pdf-table th, .pdf-table td {
    border: 1px solid black;
    padding: 8px 4px;
    word-break: break-all;
    vertical-align: middle;
  }
  .pdf-table th {
    background-color: #f0f0f0;
    font-weight: bold;
  }
`;

export const PdfTemplate = ({
  printRef,
  formData,
  filteredLogs,
}: PdfTemplateProps) => {
  const sortedLogs = [...filteredLogs].sort(
    (a, b) => a.timestamp - b.timestamp,
  );

  return (
    <div
      style={{
        position: "absolute",
        top: "-9999px",
        left: "-9999px",
        background: "#fff",
        width: "1200px",
      }}
    >
      <style>{pdfTableStyle}</style>
      <div
        ref={printRef}
        id="pdfContentWrapper"
        style={{ padding: "30px 40px", boxSizing: "border-box", width: "100%" }}
      >
        <div style={{ fontFamily: "'Malgun Gothic', sans-serif" }}>
          <h2
            style={{
              textAlign: "center",
              textDecoration: "underline",
              fontSize: "26px",
              marginBottom: "25px",
            }}
          >
            노인일자리 및 사회활동 지원사업 공익활동 활동일지(예시)
          </h2>

          {/* 상단 기본 정보 영역 */}
          <table className="pdf-table">
            <tbody>
              <tr>
                <th style={{ width: "15%" }}>기관명</th>
                <td style={{ width: "35%" }}>{formData.orgName}</td>
                <th style={{ width: "15%" }}>참여사업명</th>
                <td style={{ width: "35%" }}>{formData.projectName}</td>
              </tr>
              <tr>
                <th>참여자 성명</th>
                <td>{formData.userName}</td>
                <th>수요처명(서비스대상자명)</th>
                <td>{formData.demandName}</td>
              </tr>
            </tbody>
          </table>

          <div style={{ height: "15px" }} />

          {/* 인쇄용 테이블 */}
          <table className="pdf-table">
            <thead>
              <tr>
                <th rowSpan={2} style={{ width: "5%" }}>
                  연번
                </th>
                <th rowSpan={2} style={{ width: "10%" }}>
                  활동일
                </th>
                <th colSpan={3} style={{ width: "22%" }}>
                  활동시간
                </th>
                <th rowSpan={2} style={{ width: "21%" }}>
                  활동내용
                </th>
                <th rowSpan={2} style={{ width: "12%" }}>
                  활동장소
                </th>
                <th rowSpan={2} style={{ width: "16%" }}>
                  안전사고 발생유무
                  <br />
                  (사고내용, 조치내용)
                </th>
                <th rowSpan={2} style={{ width: "7%" }}>
                  참여자
                  <br />
                  서명
                </th>
                <th rowSpan={2} style={{ width: "7%" }}>
                  확인자
                  <br />
                  (수요처(자))
                  <br />
                  서명
                </th>
              </tr>
              <tr>
                <th>
                  시작
                  <br />
                  (00:00)
                </th>
                <th>
                  종료
                  <br />
                  (00:00)
                </th>
                <th>총시간</th>
              </tr>
            </thead>
            <tbody>
              {sortedLogs.map((log, i) => (
                <tr key={log.id || i}>
                  <td>{i + 1}</td>
                  <td>{log.date}</td>
                  <td>{log.start}</td>
                  <td>{log.end}</td>
                  <td>{log.totalTime}</td>
                  <td>{log.content}</td>
                  <td>{log.place}</td>
                  <td>
                    {log.accident === "유" ? (
                      <>
                        {log.accident}
                        <br />({log.accidentDetail} / {log.accidentAction})
                      </>
                    ) : (
                      log.accident
                    )}
                  </td>
                  <td>
                    {log.uSign && (
                      <img
                        src={log.uSign}
                        alt="user-sign"
                        style={{ height: "35px", width: "auto" }}
                      />
                    )}
                  </td>
                  <td>
                    {log.dSign && (
                      <img
                        src={log.dSign}
                        alt="demand-sign"
                        style={{ height: "35px", width: "auto" }}
                      />
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <div
            style={{ marginTop: "15px", fontSize: "14px", textAlign: "left" }}
          >
            ※ 활동 내역이 사실과 틀림없음을 확인하였으며, 추후 보조금
            부정수급으로 인한 제재 등의 조치에 동의합니다.
          </div>
        </div>
      </div>
    </div>
  );
};

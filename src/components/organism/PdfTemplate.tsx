import React from "react";
import type { ActivityLogFormData, ActivityLogItem } from "../../types/form";

interface PdfTemplateProps {
  printRef: React.RefObject<HTMLDivElement | null>;
  formData: ActivityLogFormData;
  filteredLogs: ActivityLogItem[];
}

export const PdfTemplate = ({
  printRef,
  formData,
  filteredLogs,
}: PdfTemplateProps) => {
  return (
    <div style={{ position: "absolute", left: "-9999px", top: 0 }}>
      <div
        ref={printRef}
        id="pdfContentWrapper"
        style={{
          width: "1000px",
          padding: "20px",
          background: "#fff",
          fontFamily: "sans-serif",
        }}
      >
        <h2 style={{ textAlign: "center", marginBottom: "20px" }}>
          노인일자리 및 사회활동 지원사업 공익활동 활동일지
        </h2>

        {/* 상단 기본 정보 영역 */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            marginBottom: "15px",
            fontSize: "14px",
          }}
        >
          <div>
            <strong>기관명:</strong> {formData.orgName}
          </div>
          <div>
            <strong>참여사업명:</strong> {formData.projectName}
          </div>
          <div>
            <strong>참여자 성명:</strong> {formData.userName}
          </div>
          <div>
            <strong>수요처명:</strong> {formData.demandName}
          </div>
        </div>

        {/* 인쇄용 테이블 */}
        <table
          style={{
            width: "100%",
            borderCollapse: "collapse",
            fontSize: "12px",
          }}
          border={1}
        >
          <thead>
            <tr style={{ backgroundColor: "#f0f3f5" }}>
              <th style={{ padding: "8px" }}>연번</th>
              <th>활동일</th>
              <th>시작</th>
              <th>종료</th>
              <th>총시간</th>
              <th>활동내용</th>
              <th>활동장소</th>
              <th>안전사고</th>
              <th>참여자 서명</th>
              <th>확인자 서명</th>
            </tr>
          </thead>
          <tbody>
            {filteredLogs.map((log, i) => (
              <tr key={log.id || i} style={{ textAlign: "center" }}>
                <td style={{ padding: "8px" }}>{i + 1}</td>
                <td>{log.date}</td>
                <td>{log.start}</td>
                <td>{log.end}</td>
                <td>{log.totalTime}</td>
                <td style={{ textAlign: "left", padding: "0 5px" }}>
                  {log.content}
                </td>
                <td>{log.place}</td>
                <td>
                  {log.accident === "유"
                    ? `${log.accident} (${log.accidentDetail} / ${log.accidentAction})`
                    : log.accident}
                </td>
                <td>
                  {log.uSign && (
                    <img
                      src={log.uSign}
                      alt="user-sign"
                      style={{ height: "30px", width: "auto" }}
                    />
                  )}
                </td>
                <td>
                  {log.dSign && (
                    <img
                      src={log.dSign}
                      alt="demand-sign"
                      style={{ height: "30px", width: "auto" }}
                    />
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

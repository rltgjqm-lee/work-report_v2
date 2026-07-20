import { useEffect, useState } from "react";

import {
  listSafetyAlerts,
  sendTestSafetyAlert,
} from "../api/admin/safetyAlerts";
import { listPrograms } from "../api/admin/programs";
import { btnPrimaryClass, inputClass, selectClass } from "../uiClasses";
import type { Program, SafetyAlert } from "../types";

const SOURCE_LABEL: Record<string, string> = {
  MOIS: "행안부",
  MANUAL: "테스트",
};

/**
 * 관리자 페이지 > 재난 문자 페이지입니다.
 *
 */
const DisasterMessagesPage = () => {
  const [alerts, setAlerts] = useState<SafetyAlert[]>([]);
  const [programs, setPrograms] = useState<Program[]>([]);
  const [testProgramId, setTestProgramId] = useState("");
  const [testMessage, setTestMessage] = useState("");
  const [testResult, setTestResult] = useState<string | null>(null);

  const refresh = () => listSafetyAlerts().then(setAlerts);

  useEffect(() => {
    refresh();
    listPrograms().then(setPrograms);
  }, []);

  const handleSendTest = async () => {
    if (!testProgramId || !testMessage) {
      alert("사업단과 메시지를 입력해주세요.");

      return;
    }
    try {
      const result = await sendTestSafetyAlert({
        message: testMessage,
        programId: Number(testProgramId),
      });
      setTestResult(
        `발송 완료 — 대상 ${result.targetCount}건 중 ${result.successCount}건 성공`,
      );
      setTestMessage("");
      refresh();
    } catch (error) {
      alert(
        error instanceof Error ? error.message : "테스트 발송에 실패했습니다.",
      );
    }
  };

  return (
    <div>
      <div className="mb-5">
        <h1 className="text-[21px] font-bold m-0">재난문자 테스트</h1>
        <p className="text-[13px] text-[#6b7280] mt-1.5">
          테스트 발송 및 행안부 수신 원본 전체(매칭 안 돼 발송 안 된 것 포함)를
          확인하는 진단용 화면입니다. 실제 발송 이력은 "재난문자 발송이력"
          메뉴를 확인하세요.
        </p>
      </div>

      <div className="bg-white border border-[#e2e5eb] rounded-[2px] px-5 py-4 mb-5">
        <div className="text-[13px] font-bold mb-2.5">테스트 발송</div>
        <div className="flex items-center gap-2.5 flex-wrap">
          <select
            className={selectClass}
            value={testProgramId}
            onChange={(event) => setTestProgramId(event.target.value)}
          >
            <option value="">사업단을 선택하세요</option>
            {programs.map((program) => (
              <option key={program.id} value={program.id}>
                {program.name}
              </option>
            ))}
          </select>
          <input
            className={inputClass + " flex-1 min-w-[240px]"}
            placeholder="테스트 메시지를 입력하세요"
            value={testMessage}
            onChange={(event) => setTestMessage(event.target.value)}
          />
          <button className={btnPrimaryClass} onClick={handleSendTest}>
            발송
          </button>
        </div>
        {testResult && (
          <div className="text-xs text-[#1e3a5f] mt-2.5">{testResult}</div>
        )}
      </div>

      <div className="bg-white border border-[#e2e5eb] rounded-[2px]">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[860px] table-fixed border-collapse">
            <thead>
              <tr>
                <th className="w-[160px] text-left text-[11px] font-bold uppercase tracking-wide text-[#6b7280] bg-[#f7f8fa] px-5 py-[11px] border-b border-[#e2e5eb]">
                  발송시각
                </th>
                <th className="w-[140px] text-left text-[11px] font-bold uppercase tracking-wide text-[#6b7280] bg-[#f7f8fa] px-5 py-[11px] border-b border-[#e2e5eb]">
                  지역
                </th>
                <th className="w-[80px] text-left text-[11px] font-bold uppercase tracking-wide text-[#6b7280] bg-[#f7f8fa] px-5 py-[11px] border-b border-[#e2e5eb]">
                  종류
                </th>
                <th className="w-[90px] text-left text-[11px] font-bold uppercase tracking-wide text-[#6b7280] bg-[#f7f8fa] px-5 py-[11px] border-b border-[#e2e5eb]">
                  구분
                </th>
                <th className="text-left text-[11px] font-bold uppercase tracking-wide text-[#6b7280] bg-[#f7f8fa] px-5 py-[11px] border-b border-[#e2e5eb]">
                  내용
                </th>
                <th className="w-[100px] text-left text-[11px] font-bold uppercase tracking-wide text-[#6b7280] bg-[#f7f8fa] px-5 py-[11px] border-b border-[#e2e5eb]">
                  대상
                </th>
                <th className="w-[100px] text-left text-[11px] font-bold uppercase tracking-wide text-[#6b7280] bg-[#f7f8fa] px-5 py-[11px] border-b border-[#e2e5eb]">
                  성공/실패
                </th>
              </tr>
            </thead>
            <tbody>
              {alerts.map((alert) => (
                <tr key={alert.alertId} className="hover:bg-[#f8fafc]">
                  <td className="px-5 py-[13px] text-[13px] border-b border-[#eef0f3] whitespace-nowrap">
                    {alert.sentAt}
                  </td>
                  <td className="px-5 py-[13px] text-[13px] border-b border-[#eef0f3]">
                    {alert.region}
                  </td>
                  <td className="px-5 py-[13px] text-[13px] border-b border-[#eef0f3]">
                    {alert.alertType ?? "-"}
                  </td>
                  <td className="px-5 py-[13px] text-[13px] border-b border-[#eef0f3]">
                    {SOURCE_LABEL[alert.source]}
                  </td>
                  <td className="px-5 py-[13px] text-[13px] border-b border-[#eef0f3] whitespace-normal break-words">
                    {alert.message}
                  </td>
                  <td className="px-5 py-[13px] text-[13px] border-b border-[#eef0f3]">
                    {alert.targetCount}건
                  </td>
                  <td className="px-5 py-[13px] text-[13px] border-b border-[#eef0f3]">
                    {alert.successCount} / {alert.failCount}
                  </td>
                </tr>
              ))}
              {alerts.length === 0 && (
                <tr>
                  <td
                    colSpan={7}
                    className="px-5 py-8 text-center text-[13px] text-[#9aa1ab]"
                  >
                    발송된 재난문자가 없습니다.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default DisasterMessagesPage;

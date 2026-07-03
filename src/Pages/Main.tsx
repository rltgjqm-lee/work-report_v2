const Main = () => {
  // 예시를 위해 임의로 함수들을 정의해 두었습니다.
  // 실제 컴포넌트 내부나 외부에서 정의하신 함수명과 매칭하시면 됩니다.
  const saveConfigOnly = () => {};
  const nextFromPage1 = () => {};
  // const changeMonth = (val: string) => {
  //   return val;
  // };
  const startNewLog = () => {};
  const exportReports = () => {};
  const updateHiddenTime = (type: string) => {
    return type;
  };
  const savePage3 = () => {};
  const nextFromPage3 = () => {};
  const savePage4 = () => {};
  const nextFromPage4 = () => {};
  const toggleAccidentInput = (bool: boolean) => {
    return bool;
  };
  const savePage5 = () => {};
  const nextFromPage5 = () => {};
  // const clearCanvas = (ctx: string, canvas: string) => {
  //   return { ctx, canvas };
  // };
  const saveLog = () => {};
  const exportReportsFromPage6 = () => {};
  const goHomeFromPage6 = () => {};

  // 가상의 ctx, canvas 변수 (오류 방지용 예시)
  // const userCtx = null,
  //   userCanvas = null,
  //   demandCtx = null,
  //   demandCanvas = null;

  return (
    <div>
      <div className="container">
        <div className="top-bar">
          <div style={{ fontSize: "20px", letterSpacing: "-0.5px", whiteSpace: "nowrap" }}>노인공익활동사업 활동일지</div>
          <div style={{ fontSize: "15px", fontWeight: "normal", marginTop: "6px", color: "#d0e1ff" }}>
            <span id="topProjName">참여사업</span> 사업입니다.
          </div>
        </div>

        {/* Page 1: 초기 설정 */}
        <div className="content" id="page1" style={{ display: "flex" }}>
          <div className="main-title">노인공익활동사업 활동일지</div>
          <div className="input-row">
            <div className="label">기관명</div>
            <input type="text" id="orgName" className="input-field" placeholder="예) 한국노인인력개발원" />
          </div>
          <div className="input-row">
            <div className="label">참여사업명</div>
            <input type="text" id="projectName" className="input-field" placeholder="예) 안전한 길거리 조성" />
          </div>
          <div className="input-row">
            <div className="label">
              수요처명
              <br />
              <span style={{ fontSize: "14px", fontWeight: "normal" }}>(서비스대상자명)</span>
            </div>
            <input type="text" id="demandName" className="input-field" placeholder="예) 00주민센터" />
          </div>
          <div className="input-row">
            <div className="label">참여자 성명</div>
            <input type="text" id="userName" className="input-field" placeholder="성함 입력" />
          </div>
          <div className="btn-group">
            {/* 괄호를 제거하여 함수 자체를 넘겨줍니다 */}
            <button className="btn btn-blue" onClick={saveConfigOnly}>
              저장하기
            </button>
            <button className="btn btn-blue" onClick={nextFromPage1}>
              다음
            </button>
          </div>
        </div>

        {/* Page 2: 대시보드 (리스트) */}
        <div className="content" id="page2">
          <div className="main-title">
            <span id="dUser" style={{ color: "#4364F7" }}>
              홍길동
            </span>
            님 환영합니다
            <br />
            <span style={{ fontSize: "16px", color: "#7f8c8d" }} id="dOrg">
              노인일자리 및 사회활동 지원사업
            </span>
          </div>

          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: "15px",
              background: "#fff",
              padding: "10px 15px",
              borderRadius: "12px",
              boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
            }}
          >
            {/* 인자가 필요한 함수는 화살표 함수 형태로 감싸줍니다 */}
            <button
              className="btn btn-white"
              style={{ flex: "none", padding: "5px 20px", fontSize: "18px" }}
              // onClick={() => changeMonth(-1)}
            >
              ◀
            </button>
            <div id="currentMonthDisplay" style={{ fontSize: "18px", fontWeight: "bold", color: "#2c3e50" }}>
              2026년 5월
            </div>
            <button
              className="btn btn-white"
              style={{ flex: "none", padding: "5px 20px", fontSize: "18px" }}
              // onClick={() => changeMonth(1)}
            >
              ▶
            </button>
          </div>

          <div className="activity-list" id="activityList">
            {/* 리스트 아이템 렌더링 */}
          </div>
          <div className="btn-group" style={{ flexDirection: "column", gap: "10px" }}>
            <button className="btn btn-blue" onClick={startNewLog}>
              새로운 일지 작성하기
            </button>
            <button className="btn btn-white" onClick={exportReports}>
              보고서 출력 (PDF / 엑셀)
            </button>
          </div>
        </div>

        {/* Page 3: 활동 일시 */}
        <div className="content" id="page3">
          <div className="main-title">활동 일시를 입력해주세요</div>
          <div className="input-col">
            <div className="label" style={{ width: "100%" }}>
              활동일 <span style={{ fontSize: "12px", fontWeight: "normal", color: "#e74c3c" }}>(*활동일을 선택하여 주세요)</span>
            </div>
            <input type="date" id="actDate" className="input-field" />
          </div>
          <div className="input-col">
            <div className="label" style={{ width: "100%" }}>
              활동시간을 선택하여 주세요 <br />
              <span style={{ fontSize: "12px", fontWeight: "normal", color: "#e74c3c" }}>(*활동 종료 후 시간을 선택하여 주세요)</span>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "12px", width: "100%" }}>
              <div style={{ width: "100%" }}>
                <div style={{ marginBottom: "5px", fontWeight: "bold", color: "#34495e", fontSize: "14px" }}>시작</div>
                <div style={{ display: "flex", gap: "8px", width: "100%" }}>
                  {/* 소문자 onchange를 대문자 onChange로 변경하고 화살표 함수 적용 */}
                  <select id="startAmpm" className="input-field time-select" onChange={() => updateHiddenTime("start")} defaultValue="AM">
                    <option value="AM">오전</option>
                    <option value="PM">오후</option>
                  </select>
                  <select id="startHour" className="input-field time-select" onChange={() => updateHiddenTime("start")}></select>
                  <span style={{ fontSize: "16px", fontWeight: "bold", alignSelf: "center" }}>:</span>
                  <select id="startMin" className="input-field time-select" onChange={() => updateHiddenTime("start")}></select>
                </div>
                <input type="hidden" id="actStart" />
              </div>
              <div style={{ width: "100%" }}>
                <div style={{ marginBottom: "5px", fontWeight: "bold", color: "#34495e", fontSize: "14px" }}>종료</div>
                <div style={{ display: "flex", gap: "8px", width: "100%" }}>
                  <select id="endAmpm" className="input-field time-select" onChange={() => updateHiddenTime("end")} defaultValue="PM">
                    <option value="AM">오전</option>
                    <option value="PM">오후</option>
                  </select>
                  <select id="endHour" className="input-field time-select" onChange={() => updateHiddenTime("end")}></select>
                  <span style={{ fontSize: "16px", fontWeight: "bold", alignSelf: "center" }}>:</span>
                  <select id="endMin" className="input-field time-select" onChange={() => updateHiddenTime("end")}></select>
                </div>
                <input type="hidden" id="actEnd" />
              </div>
            </div>
          </div>
          <div className="input-col">
            <div style={{ fontWeight: "bold", color: "#34495e", marginBottom: "5px" }}>총</div>
            <div style={{ display: "flex", alignItems: "center", gap: "10px", width: "100%" }}>
              <div
                id="actTotalTime"
                className="input-field"
                style={{ background: "#f9f9f9", textAlign: "center", color: "#00a0e9", fontWeight: "bold" }}
              >
                - 시간
              </div>
            </div>
          </div>
          <div className="btn-group">
            <button className="btn btn-blue" onClick={savePage3}>
              저장하기
            </button>
            <button className="btn btn-white" onClick={nextFromPage3}>
              다음
            </button>
          </div>
        </div>

        {/* Page 4: 활동 내용/장소 */}
        <div className="content" id="page4">
          <div className="main-title">활동 내용 및 장소</div>
          <div className="input-col">
            <div className="label" style={{ width: "100%", flex: "none" }}>
              활동내용
            </div>
            <textarea id="actContent" className="input-field" rows={2} placeholder="오늘 수행하신 활동 내용을 적어주세요."></textarea>
          </div>
          <div className="input-col">
            <div className="label" style={{ width: "100%", flex: "none" }}>
              활동장소
            </div>
            <textarea id="actPlace" className="input-field" rows={2} placeholder="활동하신 장소를 적어주세요."></textarea>
          </div>
          <div className="btn-group">
            <button className="btn btn-blue" onClick={savePage4}>
              저장하기
            </button>
            <button className="btn btn-white" onClick={nextFromPage4}>
              다음
            </button>
          </div>
        </div>

        {/* Page 5: 안전사고 */}
        <div className="content" id="page5">
          <div className="main-title">안전사고 유무 확인</div>
          <div className="input-col">
            <div className="label" style={{ width: "100%", flex: "none" }}>
              안전사고 발생유무
            </div>
            <div className="radio-group" style={{ width: "100%", flex: "none", gap: "30px" }}>
              <label className="radio-label">
                <input type="radio" name="accident" value="유" onClick={() => toggleAccidentInput(true)} /> 유
              </label>
              <label className="radio-label">
                <input type="radio" name="accident" value="무" defaultChecked onClick={() => toggleAccidentInput(false)} /> 무
              </label>
            </div>
          </div>
          <div className="input-col" id="accidentDetailRow" style={{ display: "none" }}>
            <div className="label" style={{ width: "100%", flex: "none" }}>
              사고내용 및 조치내용
            </div>
            <input type="text" id="accidentDetail" className="input-field" placeholder="예) 넘어짐, 응급조치 후 지속" />
          </div>
          <div className="input-col" id="accidentActionRow" style={{ display: "none" }}>
            <div className="label" style={{ width: "100%", flex: "none" }}>
              안전사고 발생 후 업무 수행
            </div>
            <div className="radio-group" style={{ width: "100%", flex: "none", gap: "30px" }}>
              <label className="radio-label">
                <input type="radio" name="accidentAction" value="귀가" /> 귀가
              </label>
              <label className="radio-label">
                <input type="radio" name="accidentAction" value="업무수행" defaultChecked /> 업무수행
              </label>
            </div>
          </div>
          <div className="btn-group">
            <button className="btn btn-blue" onClick={savePage5}>
              저장하기
            </button>
            <button className="btn btn-white" onClick={nextFromPage5}>
              다음
            </button>
          </div>
        </div>

        {/* Page 6: 서명하기 */}
        <div className="content" id="page6">
          <div className="main-title">서명을 진행해주세요</div>

          <div className="input-col" style={{ marginBottom: "5px" }}>
            <div className="label" style={{ width: "100%", flex: "none" }}>
              참여자 서명
            </div>
            <div className="canvas-container" style={{ marginBottom: 0, width: "100%", flex: "none" }}>
              <canvas id="userCanvas"></canvas>
              <button
                className="clear-btn"
                //  onClick={() => clearCanvas(userCtx, userCanvas)}
              >
                지우기
              </button>
            </div>
          </div>
          <div style={{ fontSize: "13px", color: "#7f8c8d", textAlign: "right", marginBottom: "25px" }}>
            * 최초 서명 시 이후 계속 사용됩니다.
          </div>

          <div className="input-col" style={{ marginBottom: "5px" }}>
            <div className="label" style={{ width: "100%", flex: "none" }}>
              확인자 (수요처) 서명 <span style={{ fontSize: "14px", fontWeight: "normal" }}>(선택)</span>
            </div>
            <div className="canvas-container" style={{ marginBottom: 0, width: "100%", flex: "none" }}>
              <canvas id="demandCanvas"></canvas>
              <button
                className="clear-btn"
                // onClick={() => clearCanvas(demandCtx, demandCanvas)}
              >
                지우기
              </button>
            </div>
          </div>
          <label style={{ display: "flex", alignItems: "flex-start", gap: "8px", marginBottom: "25px", cursor: "pointer" }}>
            <input type="checkbox" id="demandConsentCheck" defaultChecked style={{ width: "18px", height: "18px", marginTop: "2px" }} />
            <div style={{ fontSize: "14px", color: "#2c3e50" }}>
              <strong>이 서명으로 계속 사용함에 동의합니다.</strong>
              <br />
              <span style={{ fontSize: "12px", color: "#7f8c8d" }}>(체크 해제 시 다음 작성 시 서명이 지워진 채로 시작합니다)</span>
            </div>
          </label>

          <div className="btn-group">
            <button className="btn btn-blue" onClick={saveLog}>
              저장하기
            </button>
            <button className="btn btn-white" onClick={exportReportsFromPage6}>
              보고서
            </button>
            <button className="btn btn-white" onClick={goHomeFromPage6}>
              처음으로
            </button>
          </div>
        </div>
      </div>

      {/* PDF 렌더링용 숨김 템플릿 */}
      <div id="pdfContainer">
        <div id="pdfContentWrapper">
          <div id="pdfContent" style={{ fontFamily: "'Malgun Gothic', sans-serif" }}>
            <h2 style={{ textAlign: "center", textDecoration: "underline", fontSize: "26px", marginBottom: "25px" }}>
              노인일자리 및 사회활동 지원사업 공익활동 활동일지(예시)
            </h2>
            <table className="pdf-table">
              <tbody>
                <tr>
                  <th style={{ width: "15%" }}>기관명</th>
                  <td style={{ width: "35%" }} id="pOrg"></td>
                  <th style={{ width: "15%" }}>참여사업명</th>
                  <td style={{ width: "35%" }} id="pProject"></td>
                </tr>
                <tr>
                  <th>참여자 성명</th>
                  <td id="pUser"></td>
                  <th>수요처명(서비스대상자명)</th>
                  <td id="pDemand"></td>
                </tr>
              </tbody>
            </table>
            <div style={{ height: "15px" }}></div>
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
              <tbody id="pRows">{/* Data goes here */}</tbody>
            </table>
            <div style={{ marginTop: "15px", fontSize: "14px", textAlign: "left" }}>
              ※ 활동 내역이 사실과 틀림없음을 확인하였으며, 추후 보조금 부정수급으로 인한 제재 등의 조치에 동의합니다.
            </div>
          </div>
        </div>
      </div>

      {/* 커스텀 알림 모달 */}
      <div
        id="customModal"
        style={{
          display: "none",
          position: "fixed",
          top: 0,
          left: 0,
          width: "100%",
          height: "100%",
          background: "rgba(0,0,0,0.5)",
          zIndex: 9999,
          justifyContent: "center",
          alignItems: "center",
        }}
      >
        <div
          style={{
            background: "#fff",
            padding: "30px",
            borderRadius: "12px",
            maxWidth: "400px",
            width: "80%",
            boxShadow: "0 10px 25px rgba(0,0,0,0.2)",
          }}
        >
          <div
            id="modalMessage"
            style={{ fontSize: "18px", marginBottom: "25px", lineHeight: 1.5, whiteSpace: "pre-wrap", textAlign: "left", color: "#2c3e50" }}
          ></div>
          <div id="modalButtons" style={{ display: "flex", flexDirection: "row", gap: "10px", justifyContent: "center" }}>
            <button id="modalBtnOk" className="btn btn-blue" style={{ flex: 1, padding: "14px", fontSize: "16px" }}>
              확인
            </button>
            <button id="modalBtnCancel" className="btn btn-white" style={{ flex: 1, padding: "14px", fontSize: "16px", display: "none" }}>
              취소
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Main;

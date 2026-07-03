const Main = () => {
  // 예시를 위해 임의로 함수들을 정의해 두었습니다.
  const saveConfigOnly = () => {};
  const nextFromPage1 = () => {};
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
  const saveLog = () => {};
  const exportReportsFromPage6 = () => {};
  const goHomeFromPage6 = () => {};

  return (
    <div className="w-full min-h-screen flex justify-center items-center bg-[#f0f0f0] p-0 min-[601px]:p-4 select-none">
      {/* Container */}
      <div className="w-[95%] max-w-[600px] bg-white rounded-xl shadow-2xl overflow-hidden min-h-[550px] flex flex-col relative box-border self-stretch max-[600px]:w-[calc(100%-20px)] max-[600px]:max-w-full max-[600px]:shadow-md max-[600px]:min-h-[calc(100dvh-32px)] max-[600px]:m-[12px_10px_0_10px]">
        {/* Top Bar */}
        <div className="bg-[#2c3e50] text-white p-[15px_25px] font-bold max-[600px]:p-[18px_20px] max-[600px]:rounded-[12px_12px_16px_16px]">
          <div className="text-[20px] tracking-[-0.5px] whitespace-nowrap">노인공익활동사업 활동일지</div>
          <div className="text-[15px] font-normal mt-[6px] text-[#d0e1ff]">
            <span id="topProjName">참여사업</span> 사업입니다.
          </div>
        </div>

        {/* Page 1: 초기 설정 */}
        <div className="p-[30px_20px] flex-1 flex flex-col max-[600px]:p-[20px_15px]" id="page1" style={{ display: "flex" }}>
          <div className="text-[22px] font-bold mb-[25px] text-[#2c3e50] text-left whitespace-nowrap tracking-[-0.5px] max-[600px]:text-[20px] max-[600px]:mb-[18px]">
            노인공익활동사업 활동일지
          </div>

          <div className="flex flex-col items-start mb-[25px] gap-2 max-[600px]:mb-[18px] max-[600px]:gap-[6px]">
            <div className="text-[16px] font-bold w-full text-[#34495e] max-[600px]:text-[15px] max-[600px]:mb-[2px]">기관명</div>
            <input
              type="text"
              id="orgName"
              className="w-full p-[14px] text-[16px] font-sans border-[2.5px] border-[#2c3e50] rounded-xl outline-none box-border max-[600px]:p-[10px] max-[600px]:text-[14px] max-[600px]:border-[1.5px]"
              placeholder="예) 한국노인인력개발원"
            />
          </div>

          <div className="flex flex-col items-start mb-[25px] gap-2 max-[600px]:mb-[18px] max-[600px]:gap-[6px]">
            <div className="text-[16px] font-bold w-full text-[#34495e] max-[600px]:text-[15px] max-[600px]:mb-[2px]">참여사업명</div>
            <input
              type="text"
              id="projectName"
              className="w-full p-[14px] text-[16px] font-sans border-[2.5px] border-[#2c3e50] rounded-xl outline-none box-border max-[600px]:p-[10px] max-[600px]:text-[14px] max-[600px]:border-[1.5px]"
              placeholder="예) 안전한 길거리 조성"
            />
          </div>

          <div className="flex flex-col items-start mb-[25px] gap-2 max-[600px]:mb-[18px] max-[600px]:gap-[6px]">
            <div className="text-[16px] font-bold w-full text-[#34495e] max-[600px]:text-[15px] max-[600px]:mb-[2px]">
              수요처명 <br />
              <span className="text-[14px] font-normal">(서비스대상자명)</span>
            </div>
            <input
              type="text"
              id="demandName"
              className="w-full p-[14px] text-[16px] font-sans border-[2.5px] border-[#2c3e50] rounded-xl outline-none box-border max-[600px]:p-[10px] max-[600px]:text-[14px] max-[600px]:border-[1.5px]"
              placeholder="예) 00주민센터"
            />
          </div>

          <div className="flex flex-col items-start mb-[25px] gap-2 max-[600px]:mb-[18px] max-[600px]:gap-[6px]">
            <div className="text-[16px] font-bold w-full text-[#34495e] max-[600px]:text-[15px] max-[600px]:mb-[2px]">참여자 성명</div>
            <input
              type="text"
              id="userName"
              className="w-full p-[14px] text-[16px] font-sans border-[2.5px] border-[#2c3e50] rounded-xl outline-none box-border max-[600px]:p-[10px] max-[600px]:text-[14px] max-[600px]:border-[1.5px]"
              placeholder="성함 입력"
            />
          </div>

          <div className="flex justify-center gap-2 mt-auto pt-5 max-[600px]:mt-5 max-[600px]:pt-0">
            <button
              className="flex-1 p-[14px] text-[18px] font-bold font-sans rounded-xl cursor-pointer border-none bg-[#00a0e9] text-white max-[600px]:p-[12px] max-[600px]:text-[15px]"
              onClick={saveConfigOnly}
            >
              저장하기
            </button>
            <button
              className="flex-1 p-[14px] text-[18px] font-bold font-sans rounded-xl cursor-pointer bg-white text-[#222] border border-[#222] max-[600px]:p-[12px] max-[600px]:text-[15px]"
              onClick={nextFromPage1}
            >
              다음
            </button>
          </div>
        </div>

        {/* Page 2: 대시보드 (리스트) */}
        <div className="p-[30px_20px] flex-1 flex-col max-[600px]:p-[20px_15px]" id="page2" style={{ display: "none" }}>
          <div className="text-[22px] font-bold mb-[25px] text-[#2c3e50] text-left tracking-[-0.5px] max-[600px]:text-[20px] max-[600px]:mb-[18px]">
            <span id="dUser" className="text-[#4364F7]">
              홍길동
            </span>
            님 환영합니다 <br />
            <span className="text-[16px] text-[#7f8c8d]" id="dOrg">
              노인일자리 및 사회활동 지원사업
            </span>
          </div>

          <div className="flex justify-between items-center mb-[15px] bg-white p-[10px_15px] rounded-xl shadow-[0_1px_3px_rgba(0,0,0,0.1)]">
            <button className="flex-none p-[5px_20px] text-[18px] font-bold font-sans rounded-xl cursor-pointer bg-white text-[#222] border border-[#222]">
              ◀
            </button>
            <div id="currentMonthDisplay" className="text-[18px] font-bold text-[#2c3e50]">
              2026년 5월
            </div>
            <button className="flex-none p-[5px_20px] text-[18px] font-bold font-sans rounded-xl cursor-pointer bg-white text-[#222] border border-[#222]">
              ▶
            </button>
          </div>

          {/* 활동 리스트 (모바일에서도 3열 유지 및 스크롤바 숨김) */}
          <div
            className="flex-1 max-h-[50vh] overflow-y-auto mb-5 p-2.5 bg-[#f0f3f5] rounded-xl grid grid-cols-3 gap-2.5 content-start max-[600px]:gap-[6px] max-[600px]:p-2 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]"
            id="activityList"
          >
            {/* 리스트 아이템 예시 (필요시 컴포넌트 매핑) */}
            {/* <div className="p-2 bg-white rounded shadow text-center max-[600px]:p-[6px_5px] max-[600px]:min-h-0">1일</div> */}
          </div>

          <div className="flex flex-col gap-2.5 mt-auto pt-5 max-[600px]:mt-5 max-[600px]:pt-0">
            <button
              className="w-full p-[14px] text-[18px] font-bold font-sans rounded-xl cursor-pointer border-none bg-[#00a0e9] text-white max-[600px]:p-[12px] max-[600px]:text-[15px]"
              onClick={startNewLog}
            >
              새로운 일지 작성하기
            </button>
            <button
              className="w-full p-[14px] text-[18px] font-bold font-sans rounded-xl cursor-pointer bg-white text-[#222] border border-[#222] max-[600px]:p-[12px] max-[600px]:text-[15px]"
              onClick={exportReports}
            >
              보고서 출력 (PDF / 엑셀)
            </button>
          </div>
        </div>

        {/* Page 3: 활동 일시 */}
        <div className="p-[30px_20px] flex-1 flex-col max-[600px]:p-[20px_15px]" id="page3" style={{ display: "none" }}>
          <div className="text-[22px] font-bold mb-[25px] text-[#2c3e50] text-left tracking-[-0.5px] max-[600px]:text-[20px] max-[600px]:mb-[18px]">
            활동 일시를 입력해주세요
          </div>

          <div className="flex flex-col items-start mb-[25px] gap-2.5 max-[600px]:mb-[18px] max-[600px]:gap-[6px]">
            <div className="text-[16px] font-bold w-full text-[#34495e] max-[600px]:text-[15px] max-[600px]:mb-[2px]">
              활동일 <span className="text-[12px] font-normal text-[#e74c3c]">(*활동일을 선택하여 주세요)</span>
            </div>
            <input
              type="date"
              id="actDate"
              className="w-full p-[14px] text-[16px] font-sans border-[2.5px] border-[#2c3e50] rounded-xl outline-none box-border max-[600px]:p-[10px] max-[600px]:text-[14px] max-[600px]:border-[1.5px]"
            />
          </div>

          <div className="flex flex-col items-start mb-[25px] gap-2.5 max-[600px]:mb-[18px] max-[600px]:gap-[6px]">
            <div className="text-[16px] font-bold w-full text-[#34495e] max-[600px]:text-[15px] max-[600px]:mb-[2px]">
              활동시간을 선택하여 주세요 <br />
              <span className="text-[12px] font-normal text-[#e74c3c]">(*활동 종료 후 시간을 선택하여 주세요)</span>
            </div>
            <div className="flex flex-col gap-3 w-full">
              {/* 시작 시간 */}
              <div className="w-full">
                <div className="mb-1 font-bold text-[#34495e] text-[14px]">시작</div>
                <div className="flex gap-2 w-full">
                  <select
                    id="startAmpm"
                    className="text-center w-auto flex-1 p-2 border-[2.5px] border-[#2c3e50] rounded-xl outline-none text-[14px] max-[600px]:p-[6px_2px] max-[600px]:text-[12px] max-[600px]:border-[1.5px]"
                    onChange={() => updateHiddenTime("start")}
                    defaultValue="AM"
                  >
                    <option value="AM">오전</option>
                    <option value="PM">오후</option>
                  </select>
                  <select
                    id="startHour"
                    className="text-center w-auto flex-1 p-2 border-[2.5px] border-[#2c3e50] rounded-xl outline-none text-[14px] max-[600px]:p-[6px_2px] max-[600px]:text-[12px] max-[600px]:border-[1.5px]"
                    onChange={() => updateHiddenTime("start")}
                  ></select>
                  <span className="text-[16px] font-bold align-self-center self-center">:</span>
                  <select
                    id="startMin"
                    className="text-center w-auto flex-1 p-2 border-[2.5px] border-[#2c3e50] rounded-xl outline-none text-[14px] max-[600px]:p-[6px_2px] max-[600px]:text-[12px] max-[600px]:border-[1.5px]"
                    onChange={() => updateHiddenTime("start")}
                  ></select>
                </div>
                <input type="hidden" id="actStart" />
              </div>
              {/* 종료 시간 */}
              <div className="w-full">
                <div className="mb-1 font-bold text-[#34495e] text-[14px]">종료</div>
                <div className="flex gap-2 w-full">
                  <select
                    id="endAmpm"
                    className="text-center w-auto flex-1 p-2 border-[2.5px] border-[#2c3e50] rounded-xl outline-none text-[14px] max-[600px]:p-[6px_2px] max-[600px]:text-[12px] max-[600px]:border-[1.5px]"
                    onChange={() => updateHiddenTime("end")}
                    defaultValue="PM"
                  >
                    <option value="AM">오전</option>
                    <option value="PM">오후</option>
                  </select>
                  <select
                    id="endHour"
                    className="text-center w-auto flex-1 p-2 border-[2.5px] border-[#2c3e50] rounded-xl outline-none text-[14px] max-[600px]:p-[6px_2px] max-[600px]:text-[12px] max-[600px]:border-[1.5px]"
                    onChange={() => updateHiddenTime("end")}
                  ></select>
                  <span className="text-[16px] font-bold align-self-center self-center">:</span>
                  <select
                    id="endMin"
                    className="text-center w-auto flex-1 p-2 border-[2.5px] border-[#2c3e50] rounded-xl outline-none text-[14px] max-[600px]:p-[6px_2px] max-[600px]:text-[12px] max-[600px]:border-[1.5px]"
                    onChange={() => updateHiddenTime("end")}
                  ></select>
                </div>
                <input type="hidden" id="actEnd" />
              </div>
            </div>
          </div>

          <div className="flex flex-col items-start mb-[25px] gap-2.5 max-[600px]:mb-[18px] max-[600px]:gap-[6px]">
            <div className="font-bold text-[#34495e] mb-1">총</div>
            <div className="flex items-center gap-2.5 w-full">
              <div
                id="actTotalTime"
                className="w-full p-[14px] text-[16px] border-[2.5px] border-[#2c3e50] rounded-xl outline-none bg-[#f9f9f9] text-center color-[#00a0e9] font-bold max-[600px]:p-[10px] max-[600px]:text-[14px] max-[600px]:border-[1.5px]"
              >
                - 시간
              </div>
            </div>
          </div>

          <div className="flex justify-center gap-2 mt-auto pt-5 max-[600px]:mt-5 max-[600px]:pt-0">
            <button
              className="flex-1 p-[14px] text-[18px] font-bold font-sans rounded-xl cursor-pointer border-none bg-[#00a0e9] text-white max-[600px]:p-[12px] max-[600px]:text-[15px]"
              onClick={savePage3}
            >
              저장하기
            </button>
            <button
              className="flex-1 p-[14px] text-[18px] font-bold font-sans rounded-xl cursor-pointer bg-white text-[#222] border border-[#222] max-[600px]:p-[12px] max-[600px]:text-[15px]"
              onClick={nextFromPage3}
            >
              다음
            </button>
          </div>
        </div>

        {/* Page 4: 활동 내용/장소 */}
        <div className="p-[30px_20px] flex-1 flex-col max-[600px]:p-[20px_15px]" id="page4" style={{ display: "none" }}>
          <div className="text-[22px] font-bold mb-[25px] text-[#2c3e50] text-left tracking-[-0.5px] max-[600px]:text-[20px] max-[600px]:mb-[18px]">
            활동 내용 및 장소
          </div>

          <div className="flex flex-col items-start mb-[25px] gap-2.5 max-[600px]:mb-[18px] max-[600px]:gap-[6px]">
            <div className="text-[16px] font-bold w-full text-[#34495e] flex-none max-[600px]:text-[15px] max-[600px]:mb-[2px]">
              활동내용
            </div>
            <textarea
              id="actContent"
              className="w-full p-[14px] text-[16px] font-sans border-[2.5px] border-[#2c3e50] rounded-xl outline-none box-border max-[600px]:p-[10px] max-[600px]:text-[14px] max-[600px]:border-[1.5px]"
              rows={2}
              placeholder="오늘 수행하신 활동 내용을 적어주세요."
            ></textarea>
          </div>

          <div className="flex flex-col items-start mb-[25px] gap-2.5 max-[600px]:mb-[18px] max-[600px]:gap-[6px]">
            <div className="text-[16px] font-bold w-full text-[#34495e] flex-none max-[600px]:text-[15px] max-[600px]:mb-[2px]">
              활동장소
            </div>
            <textarea
              id="actPlace"
              className="w-full p-[14px] text-[16px] font-sans border-[2.5px] border-[#2c3e50] rounded-xl outline-none box-border max-[600px]:p-[10px] max-[600px]:text-[14px] max-[600px]:border-[1.5px]"
              rows={2}
              placeholder="활동하신 장소를 적어주세요."
            ></textarea>
          </div>

          <div className="flex justify-center gap-2 mt-auto pt-5 max-[600px]:mt-5 max-[600px]:pt-0">
            <button
              className="flex-1 p-[14px] text-[18px] font-bold font-sans rounded-xl cursor-pointer border-none bg-[#00a0e9] text-white max-[600px]:p-[12px] max-[600px]:text-[15px]"
              onClick={savePage4}
            >
              저장하기
            </button>
            <button
              className="flex-1 p-[14px] text-[18px] font-bold font-sans rounded-xl cursor-pointer bg-white text-[#222] border border-[#222] max-[600px]:p-[12px] max-[600px]:text-[15px]"
              onClick={nextFromPage4}
            >
              다음
            </button>
          </div>
        </div>

        {/* Page 5: 안전사고 */}
        <div className="p-[30px_20px] flex-1 flex-col max-[600px]:p-[20px_15px]" id="page5" style={{ display: "none" }}>
          <div className="text-[22px] font-bold mb-[25px] text-[#2c3e50] text-left tracking-[-0.5px] max-[600px]:text-[20px] max-[600px]:mb-[18px]">
            안전사고 유무 확인
          </div>

          <div className="flex flex-col items-start mb-[25px] gap-2.5 max-[600px]:mb-[18px] max-[600px]:gap-[6px]">
            <div className="text-[16px] font-bold w-full text-[#34495e] flex-none max-[600px]:text-[15px] max-[600px]:mb-[2px]">
              안전사고 발생유무
            </div>
            <div className="flex gap-[30px] mt-2.5 w-full flex-none max-[600px]:gap-5">
              <label className="text-[14px] flex items-center gap-2 cursor-pointer">
                <input type="radio" name="accident" className="w-5 h-5" onClick={() => toggleAccidentInput(true)} /> 유
              </label>
              <label className="text-[14px] flex items-center gap-2 cursor-pointer">
                <input type="radio" name="accident" className="w-5 h-5" defaultChecked onClick={() => toggleAccidentInput(false)} /> 무
              </label>
            </div>
          </div>

          <div
            className="flex flex-col items-start mb-[25px] gap-2.5 max-[600px]:mb-[18px] max-[600px]:gap-[6px]"
            id="accidentDetailRow"
            style={{ display: "none" }}
          >
            <div className="text-[16px] font-bold w-full text-[#34495e] flex-none max-[600px]:text-[15px] max-[600px]:mb-[2px]">
              사고내용 및 조치내용
            </div>
            <input
              type="text"
              id="accidentDetail"
              className="w-full p-[14px] text-[16px] font-sans border-[2.5px] border-[#2c3e50] rounded-xl outline-none box-border max-[600px]:p-[10px] max-[600px]:text-[14px] max-[600px]:border-[1.5px]"
              placeholder="예) 넘어짐, 응급조치 후 지속"
            />
          </div>

          <div
            className="flex flex-col items-start mb-[25px] gap-2.5 max-[600px]:mb-[18px] max-[600px]:gap-[6px]"
            id="accidentActionRow"
            style={{ display: "none" }}
          >
            <div className="text-[16px] font-bold w-full text-[#34495e] flex-none max-[600px]:text-[15px] max-[600px]:mb-[2px]">
              안전사고 발생 후 업무 수행
            </div>
            <div className="flex gap-[30px] mt-2.5 w-full flex-none max-[600px]:gap-5">
              <label className="text-[14px] flex items-center gap-2 cursor-pointer">
                <input type="radio" name="accidentAction" className="w-5 h-5" value="귀가" /> 귀가
              </label>
              <label className="text-[14px] flex items-center gap-2 cursor-pointer">
                <input type="radio" name="accidentAction" className="w-5 h-5" value="업무수행" defaultChecked /> 업무수행
              </label>
            </div>
          </div>

          <div className="flex justify-center gap-2 mt-auto pt-5 max-[600px]:mt-5 max-[600px]:pt-0">
            <button
              className="flex-1 p-[14px] text-[18px] font-bold font-sans rounded-xl cursor-pointer border-none bg-[#00a0e9] text-white max-[600px]:p-[12px] max-[600px]:text-[15px]"
              onClick={savePage5}
            >
              저장하기
            </button>
            <button
              className="flex-1 p-[14px] text-[18px] font-bold font-sans rounded-xl cursor-pointer bg-white text-[#222] border border-[#222] max-[600px]:p-[12px] max-[600px]:text-[15px]"
              onClick={nextFromPage5}
            >
              다음
            </button>
          </div>
        </div>

        {/* Page 6: 서명하기 */}
        <div className="p-[30px_20px] flex-1 flex-col max-[600px]:p-[20px_15px]" id="page6" style={{ display: "none" }}>
          <div className="text-[22px] font-bold mb-[25px] text-[#2c3e50] text-left tracking-[-0.5px] max-[600px]:text-[20px] max-[600px]:mb-[18px]">
            서명을 진행해주세요
          </div>

          <div className="flex flex-col items-start mb-1 gap-2.5">
            <div className="text-[16px] font-bold w-full text-[#34495e] flex-none max-[600px]:text-[15px] max-[600px]:mb-[2px]">
              참여자 서명
            </div>
            <div className="flex-1 border-2 border-dashed border-[#bdc3c7] rounded-xl bg-[#fafafa] relative w-full flex-none mb-0">
              <canvas id="userCanvas" className="w-full h-[180px] rounded-xl touch-none max-[600px]:h-[120px]"></canvas>
              <button className="absolute top-1.5 right-1.5 bg-[#ff4d4d] text-white border-none rounded p-1 text-[16px] z-20 cursor-pointer">
                지우기
              </button>
            </div>
          </div>
          <div className="text-[13px] text-[#7f8c8d] text-right mb-[25px]">* 최초 서명 시 이후 계속 사용됩니다.</div>

          <div className="flex flex-col items-start mb-1 gap-2.5">
            <div className="text-[16px] font-bold w-full text-[#34495e] flex-none max-[600px]:text-[15px] max-[600px]:mb-[2px]">
              확인자 (수요처) 서명 <span className="text-[14px] font-normal">(선택)</span>
            </div>
            <div className="flex-1 border-2 border-dashed border-[#bdc3c7] rounded-xl bg-[#fafafa] relative w-full flex-none mb-0">
              <canvas id="demandCanvas" className="w-full h-[180px] rounded-xl touch-none max-[600px]:h-[120px]"></canvas>
              <button className="absolute top-1.5 right-1.5 bg-[#ff4d4d] text-white border-none rounded p-1 text-[16px] z-20 cursor-pointer">
                지우기
              </button>
            </div>
          </div>

          <label className="flex items-start gap-2 mb-[25px] cursor-pointer mt-3">
            <input type="checkbox" id="demandConsentCheck" defaultChecked className="w-[18px] h-[18px] mt-0.5" />
            <div className="text-[14px] text-[#2c3e50]">
              <strong>이 서명으로 계속 사용함에 동의합니다.</strong> <br />
              <span className="text-[12px] text-[#7f8c8d]">(체크 해제 시 다음 작성 시 서명이 지워진 채로 시작합니다)</span>
            </div>
          </label>

          <div className="flex justify-center gap-2 mt-auto pt-5 max-[600px]:mt-5 max-[600px]:pt-0">
            <button
              className="flex-1 p-[14px] text-[18px] font-bold font-sans rounded-xl cursor-pointer border-none bg-[#00a0e9] text-white max-[600px]:p-[12px] max-[600px]:text-[15px]"
              onClick={saveLog}
            >
              저장하기
            </button>
            <button
              className="flex-1 p-[14px] text-[18px] font-bold font-sans rounded-xl cursor-pointer bg-white text-[#222] border border-[#222] max-[600px]:p-[12px] max-[600px]:text-[15px]"
              onClick={exportReportsFromPage6}
            >
              보고서
            </button>
            <button
              className="flex-1 p-[14px] text-[18px] font-bold font-sans rounded-xl cursor-pointer bg-white text-[#222] border border-[#222] max-[600px]:p-[12px] max-[600px]:text-[15px]"
              onClick={goHomeFromPage6}
            >
              처음으로
            </button>
          </div>
        </div>
      </div>

      {/* PDF 렌더링용 숨김 템플릿 */}
      <div id="pdfContainer" className="hidden absolute top-[-9999px] left-[-9999px] bg-white w-[1200px]">
        <div id="pdfContentWrapper" className="p-[30px_40px] box-border w-full">
          <div id="pdfContent" className="font-['Malgun_Gothic',_sans-serif]">
            <h2 className="text-center underline text-[26px] mb-[25px]">노인일자리 및 사회활동 지원사업 공익활동 활동일지(예시)</h2>
            <table className="w-full border-collapse border-2 border-black text-center text-[14px] text-black [&_th]:border [&_th]:border-black [&_th]:p-[8px_4px] [&_th]:bg-[#f0f0f0] [&_th]:font-bold [&_td]:border [&_td]:border-black [&_td]:p-[8px_4px] [&_td]:break-all [&_td]:vertical-middle">
              <tbody>
                <tr>
                  <th className="w-[15%]">기관명</th>
                  <td className="w-[35%]" id="pOrg"></td>
                  <th className="w-[15%]">참여사업명</th>
                  <td className="w-[35%]" id="pProject"></td>
                </tr>
                <tr>
                  <th>참여자 성명</th>
                  <td id="pUser"></td>
                  <th>수요처명(서비스대상자명)</th>
                  <td id="pDemand"></td>
                </tr>
              </tbody>
            </table>
            <div className="h-[15px]"></div>
            <table className="w-full border-collapse border-2 border-black text-center text-[14px] text-black [&_th]:border [&_th]:border-black [&_th]:p-[8px_4px] [&_th]:bg-[#f0f0f0] [&_th]:font-bold [&_td]:border [&_td]:border-black [&_td]:p-[8px_4px] [&_td]:break-all [&_td]:vertical-middle">
              <thead>
                <tr>
                  <th rowSpan={2} className="w-[5%]">
                    연번
                  </th>
                  <th rowSpan={2} className="w-[10%]">
                    활동일
                  </th>
                  <th colSpan={3} className="w-[22%]">
                    활동시간
                  </th>
                  <th rowSpan={2} className="w-[21%]">
                    활동내용
                  </th>
                  <th rowSpan={2} className="w-[12%]">
                    활동장소
                  </th>
                  <th rowSpan={2} className="w-[16%]">
                    안전사고 발생유무
                    <br />
                    (사고내용, 조치내용)
                  </th>
                  <th rowSpan={2} className="w-[7%]">
                    참여자
                    <br />
                    서명
                  </th>
                  <th rowSpan={2} className="w-[7%]">
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
              <tbody id="pRows">{/* [tr] 내부에 [break-inside:avoid] 성격 부여를 위해 기존 CSS 로직 적용 */}</tbody>
            </table>
            <div className="mt-[15px] text-[14px] text-left">
              ※ 활동 내역이 사실과 틀림없음을 확인하였으며, 추후 보조금 부정수급으로 인한 제재 등의 조치에 동의합니다.
            </div>
          </div>
        </div>
      </div>

      {/* 커스텀 알림 모달 */}
      <div id="customModal" className="hidden fixed top-0 left-0 w-full h-full bg-[rgba(0,0,0,0.5)] z-[9999] justify-center items-center">
        <div className="bg-white p-[30px] rounded-xl max-w-[400px] w-4/5 shadow-[0_10px_25px_rgba(0,0,0,0.2)]">
          <div id="modalMessage" className="text-[18px] mb-[25px] leading-normal whitespace-pre-wrap text-left text-[#2c3e50]"></div>
          <div id="modalButtons" className="flex flex-row gap-2.5 justify-center">
            <button
              id="modalBtnOk"
              className="flex-1 p-[14px] text-[16px] font-bold font-sans rounded-xl cursor-pointer border-none bg-[#00a0e9] text-white"
            >
              확인
            </button>
            <button
              id="modalBtnCancel"
              className="hidden flex-1 p-[14px] text-[16px] font-bold font-sans rounded-xl cursor-pointer bg-white text-[#222] border border-[#222]"
            >
              취소
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Main;

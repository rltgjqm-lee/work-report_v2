interface PdfTemplateProps {
  orgName?: string;
  projectName?: string;
  userName?: string;
  demandName?: string;
  activityRows?: React.ReactNode;
}

const PdfTemplate = ({
  orgName,
  projectName,
  userName,
  demandName,
  activityRows,
}: PdfTemplateProps) => {
  return (
    <div
      id="pdfContainer"
      className="hidden absolute top-[-9999px] left-[-9999px] bg-white w-[1200px]"
    >
      <div id="pdfContentWrapper" className="p-[30px_40px] box-border w-full">
        <div id="pdfContent" className="font-['Malgun_Gothic',_sans-serif]">
          <h2 className="text-center underline text-[26px] mb-[25px]">
            노인일자리 및 사회활동 지원사업 공익활동 활동일지(예시)
          </h2>

          {/* 상단 기본 정보 테이블 */}
          <table className="w-full border-collapse border-2 border-black text-center text-[14px] text-black [&_th]:border [&_th]:border-black [&_th]:p-[8px_4px] [&_th]:bg-[#f0f0f0] [&_th]:font-bold [&_td]:border [&_td]:border-black [&_td]:p-[8px_4px] [&_td]:break-all [&_td]:vertical-middle">
            <tbody>
              <tr>
                <th className="w-[15%]">기관명</th>
                <td className="w-[35%]">{orgName}</td>
                <th className="w-[15%]">참여사업명</th>
                <td className="w-[35%]">{projectName}</td>
              </tr>
              <tr>
                <th>참여자 성명</th>
                <td>{userName}</td>
                <th>수요처명(서비스대상자명)</th>
                <td>{demandName}</td>
              </tr>
            </tbody>
          </table>

          <div className="h-[15px]"></div>

          {/* 하단 상세 활동 내역 테이블 */}
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
            <tbody id="pRows">
              {/* 외부에서 동적으로 생성해서 넘겨준 행(Rows)들이 여기에 꽂힙니다. */}
              {activityRows}
            </tbody>
          </table>

          <div className="mt-[15px] text-[14px] text-left">
            ※ 활동 내역이 사실과 틀림없음을 확인하였으며, 추후 보조금
            부정수급으로 인한 제재 등의 조치에 동의합니다.
          </div>
        </div>
      </div>
    </div>
  );
};

export default PdfTemplate;

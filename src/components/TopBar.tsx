const TopBar = () => {
  return (
    <div className="bg-[#2c3e50] text-white p-[15px_25px] font-bold max-[600px]:p-[18px_20px] max-[600px]:rounded-[12px_12px_16px_16px]">
      <div className="text-[20px] tracking-[-0.5px] whitespace-nowrap">노인공익활동사업 활동일지</div>
      <div className="text-[15px] font-normal mt-[6px] text-[#d0e1ff]">
        <span id="topProjName">참여사업</span> 사업입니다.
      </div>
    </div>
  );
};
export default TopBar;

import { useNavigate } from "react-router-dom";

import { Settings } from "lucide-react";

const TopBar = () => {
  const navigate = useNavigate();
  const handleClickAdminButton = () => navigate("/admin");

  return (
    <div className="bg-[#2c3e50] text-white p-[16px_24px] font-bold max-[600px]:p-[18px_20px] rounded-t-[12px] rounded-b-[16px]">
      <div className="flex items-center justify-between">
        <div className="text-[20px] tracking-[-0.5px] whitespace-nowrap ">
          노인공익활동사업 활동일지
        </div>
        <Settings
          color="white"
          size={20}
          strokeWidth={2}
          className="cursor-pointer"
          onClick={handleClickAdminButton}
        />
      </div>

      <div className="text-[15px] mt-[6px] text-[#d0e1ff]">
        <span id="topProjName">참여사업</span> 사업입니다.
      </div>
    </div>
  );
};
export default TopBar;

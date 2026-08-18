import { Copy, Mail } from "lucide-react";

import { useToast } from "../context/useToast";

import { btnGhostClass, btnPrimaryClass } from "../uiClasses";

const CONTACT_EMAIL = "ichenny.lee@gmail.com";

/**
 * 관리자 페이지 > 문의하기 페이지입니다.
 *
 */
const ContactPage = () => {
  const { showToast } = useToast();

  const handleCopyEmailButtonClick = async () => {
    await navigator.clipboard.writeText(CONTACT_EMAIL);
    showToast("이메일 주소를 복사했습니다.");
  };

  return (
    <div>
      <div className="mb-5">
        <h1 className="text-[21px] font-bold m-0">문의하기</h1>
        <p className="text-[13px] text-text-subtle mt-1.5">
          시스템 이용 중 궁금한 점이나 개선 아이디어를 보내주세요.
        </p>
      </div>

      <div className="bg-white border border-admin-border-subtle rounded-[2px] max-w-[520px] p-8">
        <div className="w-[52px] h-[52px] rounded-xl bg-[#eef2f7] text-admin-brand flex items-center justify-center mb-[18px]">
          <Mail size={24} />
        </div>
        <div className="text-[17px] font-bold text-text-strong mb-2">문의 및 개선사항 접수</div>
        <p className="text-[13.5px] text-text-subtle leading-[1.7] mb-[22px]">
          버그 신고, 기능 문의, 개선 제안 등 모든 의견을 환영합니다.
          <br />
          아래 이메일로 화면 캡처와 함께 보내주시면 빠르게 확인하겠습니다.
        </p>
        <div className="flex items-center justify-between gap-3 px-[18px] py-4 bg-admin-surface-header rounded-lg">
          <div>
            <div className="text-xs text-admin-text-faint font-semibold mb-1">개발자 이메일</div>
            <div className="text-[15px] font-bold text-admin-brand">{CONTACT_EMAIL}</div>
          </div>
          <div className="flex items-center gap-2">
            <button
              className={`${btnGhostClass} flex items-center gap-1.5`}
              onClick={handleCopyEmailButtonClick}
            >
              <Copy size={14} />
              복사
            </button>
            <a className={btnPrimaryClass} href={`mailto:${CONTACT_EMAIL}`}>
              메일 보내기
            </a>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ContactPage;

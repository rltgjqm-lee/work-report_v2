import type { Meta, StoryObj } from "@storybook/react-vite";

import ExceptionCard from "./ExceptionCard";

const meta = {
  title: "User/Atoms/ExceptionCard",
  component: ExceptionCard,
  tags: ["autodocs"],
  parameters: { layout: "centered" },
  args: { isLargeFontMode: false },
} satisfies Meta<typeof ExceptionCard>;

export default meta;
type Story = StoryObj<typeof meta>;

// 아래 스토리들은 실제 RegistrationConfirmPage.tsx(등록확인 — 기본정보 등록 다음 단계)의
// 예외 상태 6가지를 그 코드에 있는 실제 문구 그대로 재현한다.

export const NotRegisteredWithOrg: Story = {
  args: {
    variant: "warn",
    title: "본인 확인에 실패했어요",
    body: (
      <>
        서울 강남구 <strong className="text-brand font-extrabold">행복복지관</strong>의
        <br />
        <strong className="text-brand font-extrabold">노인일자리 지원사업</strong> 사업에
        <br />
        등록이 안되어있어요
      </>
    ),
    note: "해당 기관, 사업 담당자에게 문의하여 주세요",
  },
};

export const NotRegisteredNameMismatch: Story = {
  args: {
    variant: "warn",
    title: "본인 확인에 실패했어요",
    note: "이름을 다시 확인해 주세요\n해당 기관, 사업 담당자에게 문의하여 주세요",
  },
};

export const Dropped: Story = {
  args: {
    variant: "warn",
    title: "참여가 종료되었어요",
    note: "해당 기관, 사업 담당자에게 문의하여 주세요",
  },
};

export const OnLeave: Story = {
  args: {
    variant: "caution",
    title: "현재 휴무 중이에요",
    note: "2026.09.30까지 휴무 예정이에요\n복귀 후 다시 이용해 주세요",
  },
};

export const ProgramEnded: Story = {
  args: {
    variant: "caution",
    title: "사업이 종료되었어요",
    note: "다른 사업에 참여하시려면 '이전'을 눌러 다시 선택해 주세요",
  },
};

export const ProgramNotStarted: Story = {
  args: {
    variant: "caution",
    title: "아직 사업이 시작되지 않았어요",
    note: "2026.09.15부터 이용하실 수 있어요",
  },
};

export const NotRegisteredWithOrgLargeFont: Story = {
  args: {
    ...NotRegisteredWithOrg.args,
    isLargeFontMode: true,
  },
};

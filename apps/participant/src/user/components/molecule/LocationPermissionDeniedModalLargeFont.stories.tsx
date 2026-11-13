import type { Meta, StoryObj } from "@storybook/react-vite";
import { fn } from "storybook/test";

import LocationPermissionDeniedModalLargeFont from "./LocationPermissionDeniedModalLargeFont";

const meta = {
  title: "User/Molecule/Modal/LocationPermissionDeniedModalLargeFont",
  component: LocationPermissionDeniedModalLargeFont,
  tags: ["autodocs"],
  parameters: { layout: "fullscreen", docs: { story: { inline: false, iframeHeight: 700 } } },
  args: { onClose: fn() },
} satisfies Meta<typeof LocationPermissionDeniedModalLargeFont>;

export default meta;
type Story = StoryObj<typeof meta>;

// 보통 크기(LocationPermissionDeniedModal)는 기존 센터 카드를 유지하고, 큰글씨
// 모드에서만 바텀시트로 바꿔본 첫 사례 — 결과를 보고 나머지 모달 전환 여부를 정한다.
export const Default: Story = {};

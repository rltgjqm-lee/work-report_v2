import type { Meta, StoryObj } from "@storybook/react-vite";
import { fn } from "storybook/test";

import LocationServicesOffModal from "./LocationServicesOffModal";

const meta = {
  title: "User/Molecule/Modal/LocationServicesOffModal",
  component: LocationServicesOffModal,
  tags: ["autodocs"],
  parameters: { layout: "fullscreen" },
  args: { onClose: fn(), onEnabled: fn() },
} satisfies Meta<typeof LocationServicesOffModal>;

export default meta;
type Story = StoryObj<typeof meta>;

// preview.tsx가 플랫폼을 android로 고정해두어, 실제 안드로이드 빌드와 동일하게
// "위치 켜기" 버튼(설정 화면 대신 시스템 다이얼로그로 바로 켜기)이 보인다.
export const Default: Story = {};

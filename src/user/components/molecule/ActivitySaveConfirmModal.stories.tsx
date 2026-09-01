import type { Meta, StoryObj } from "@storybook/react-vite";
import { fn } from "storybook/test";

import ActivitySaveConfirmModal from "./ActivitySaveConfirmModal";

const meta = {
  title: "User/Molecule/Modal/ActivitySaveConfirmModal",
  component: ActivitySaveConfirmModal,
  tags: ["autodocs"],
  parameters: { layout: "fullscreen", docs: { story: { inline: false, iframeHeight: 700 } } },
  args: { actContent: "재가노인 안부확인", actPlace: "행복복지관", onConfirm: fn() },
} satisfies Meta<typeof ActivitySaveConfirmModal>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

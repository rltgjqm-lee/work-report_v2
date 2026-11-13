import type { Meta, StoryObj } from "@storybook/react-vite";
import { fn } from "storybook/test";

import ActivitySaveConfirmModalLargeFont from "./ActivitySaveConfirmModalLargeFont";

const meta = {
  title: "User/Molecule/Modal/ActivitySaveConfirmModalLargeFont",
  component: ActivitySaveConfirmModalLargeFont,
  tags: ["autodocs"],
  parameters: { layout: "fullscreen", docs: { story: { inline: false, iframeHeight: 700 } } },
  args: { actContent: "재가노인 안부확인", actPlace: "행복복지관", onConfirm: fn() },
} satisfies Meta<typeof ActivitySaveConfirmModalLargeFont>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

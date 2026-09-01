import type { Meta, StoryObj } from "@storybook/react-vite";
import { fn } from "storybook/test";

import AttendanceTimeGuideModal from "./AttendanceTimeGuideModal";

const meta = {
  title: "User/Molecule/Modal/AttendanceTimeGuideModal",
  component: AttendanceTimeGuideModal,
  tags: ["autodocs"],
  parameters: { layout: "fullscreen", docs: { story: { inline: false, iframeHeight: 700 } } },
  args: { now: "08:47", shiftStart: "09:00", shiftEnd: "18:00", onConfirm: fn() },
} satisfies Meta<typeof AttendanceTimeGuideModal>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

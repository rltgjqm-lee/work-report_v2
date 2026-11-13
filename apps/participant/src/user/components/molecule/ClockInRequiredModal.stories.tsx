import type { Meta, StoryObj } from "@storybook/react-vite";
import { fn } from "storybook/test";

import ClockInRequiredModal from "./ClockInRequiredModal";

const meta = {
  title: "User/Molecule/Modal/ClockInRequiredModal",
  component: ClockInRequiredModal,
  tags: ["autodocs"],
  parameters: { layout: "fullscreen", docs: { story: { inline: false, iframeHeight: 700 } } },
  args: { onConfirm: fn() },
} satisfies Meta<typeof ClockInRequiredModal>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

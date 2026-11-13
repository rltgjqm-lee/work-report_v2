import type { Meta, StoryObj } from "@storybook/react-vite";
import { fn } from "storybook/test";

import NotWorkDayModal from "./NotWorkDayModal";

const meta = {
  title: "User/Molecule/Modal/NotWorkDayModal",
  component: NotWorkDayModal,
  tags: ["autodocs"],
  parameters: { layout: "fullscreen", docs: { story: { inline: false, iframeHeight: 700 } } },
  args: { onConfirm: fn() },
} satisfies Meta<typeof NotWorkDayModal>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

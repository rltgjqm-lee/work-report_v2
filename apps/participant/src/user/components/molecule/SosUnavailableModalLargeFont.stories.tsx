import type { Meta, StoryObj } from "@storybook/react-vite";
import { fn } from "storybook/test";

import SosUnavailableModalLargeFont from "./SosUnavailableModalLargeFont";

const meta = {
  title: "User/Molecule/Modal/SosUnavailableModalLargeFont",
  component: SosUnavailableModalLargeFont,
  tags: ["autodocs"],
  parameters: { layout: "fullscreen", docs: { story: { inline: false, iframeHeight: 700 } } },
  args: { onConfirm: fn() },
} satisfies Meta<typeof SosUnavailableModalLargeFont>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

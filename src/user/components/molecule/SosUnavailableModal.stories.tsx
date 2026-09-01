import type { Meta, StoryObj } from "@storybook/react-vite";
import { fn } from "storybook/test";

import SosUnavailableModal from "./SosUnavailableModal";

const meta = {
  title: "User/Molecule/Modal/SosUnavailableModal",
  component: SosUnavailableModal,
  tags: ["autodocs"],
  parameters: { layout: "fullscreen", docs: { story: { inline: false, iframeHeight: 700 } } },
  args: { onConfirm: fn() },
} satisfies Meta<typeof SosUnavailableModal>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

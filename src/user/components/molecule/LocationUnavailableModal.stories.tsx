import type { Meta, StoryObj } from "@storybook/react-vite";
import { fn } from "storybook/test";

import LocationUnavailableModal from "./LocationUnavailableModal";

const meta = {
  title: "User/Molecule/Modal/LocationUnavailableModal",
  component: LocationUnavailableModal,
  tags: ["autodocs"],
  parameters: { layout: "fullscreen", docs: { story: { inline: false, iframeHeight: 700 } } },
  args: { onConfirm: fn() },
} satisfies Meta<typeof LocationUnavailableModal>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

import type { Meta, StoryObj } from "@storybook/react-vite";
import { fn } from "storybook/test";

import LocationPermissionDeniedModal from "./LocationPermissionDeniedModal";

const meta = {
  title: "User/Molecule/Modal/LocationPermissionDeniedModal",
  component: LocationPermissionDeniedModal,
  tags: ["autodocs"],
  parameters: { layout: "fullscreen", docs: { story: { inline: false, iframeHeight: 700 } } },
  args: { onClose: fn() },
} satisfies Meta<typeof LocationPermissionDeniedModal>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

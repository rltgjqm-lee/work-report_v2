import type { Meta, StoryObj } from "@storybook/react-vite";
import { fn } from "storybook/test";

import LocationUnavailableModalLargeFont from "./LocationUnavailableModalLargeFont";

const meta = {
  title: "User/Molecule/Modal/LocationUnavailableModalLargeFont",
  component: LocationUnavailableModalLargeFont,
  tags: ["autodocs"],
  parameters: { layout: "fullscreen", docs: { story: { inline: false, iframeHeight: 700 } } },
  args: { onConfirm: fn() },
} satisfies Meta<typeof LocationUnavailableModalLargeFont>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

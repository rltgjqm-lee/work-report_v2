import type { Meta, StoryObj } from "@storybook/react-vite";
import { fn } from "storybook/test";

import LocationConsentModal from "./LocationConsentModal";

const meta = {
  title: "User/Molecule/Modal/LocationConsentModal",
  component: LocationConsentModal,
  tags: ["autodocs"],
  parameters: { layout: "fullscreen", docs: { story: { inline: false, iframeHeight: 700 } } },
  args: { onConfirm: fn(), isLargeFontMode: false },
} satisfies Meta<typeof LocationConsentModal>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const LargeFont: Story = {
  args: { isLargeFontMode: true },
};

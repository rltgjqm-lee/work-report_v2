import type { Meta, StoryObj } from "@storybook/react-vite";
import { fn } from "storybook/test";

import LocationConsentModal from "./LocationConsentModal";

const meta = {
  title: "User/Molecule/Modal/LocationConsentModal",
  component: LocationConsentModal,
  tags: ["autodocs"],
  parameters: { layout: "fullscreen" },
  args: { onConfirm: fn() },
} satisfies Meta<typeof LocationConsentModal>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

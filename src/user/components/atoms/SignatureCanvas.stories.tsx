import { useState } from "react";

import type { Meta, StoryObj } from "@storybook/react-vite";
import { fn } from "storybook/test";

import SignatureCanvas from "./SignatureCanvas";

const meta = {
  title: "User/Atoms/SignatureCanvas",
  component: SignatureCanvas,
  tags: ["autodocs"],
  parameters: { layout: "centered" },
  args: { value: "", onChange: fn() },
  render: (args) => {
    const [value, setValue] = useState(args.value);
    return (
      <div className="w-[320px]">
        <SignatureCanvas {...args} value={value} onChange={setValue} />
      </div>
    );
  },
} satisfies Meta<typeof SignatureCanvas>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Empty: Story = {
  args: { value: "" },
};

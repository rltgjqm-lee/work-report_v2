import { useState } from "react";

import type { Meta, StoryObj } from "@storybook/react-vite";

import LabeledInput from "./LabeledInput";

const meta = {
  title: "User/Molecule/LabeledInput",
  component: LabeledInput,
  tags: ["autodocs"],
  parameters: { layout: "centered" },
  render: (args) => {
    const [value, setValue] = useState(args.value ?? "");
    return (
      <div className="w-[320px]">
        <LabeledInput {...args} value={value} onChange={(event) => setValue(event.target.value)} />
      </div>
    );
  },
} satisfies Meta<typeof LabeledInput>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: { id: "orgName", labelTitle: "소속 기관명", placeholder: "기관명을 입력해주세요" },
};

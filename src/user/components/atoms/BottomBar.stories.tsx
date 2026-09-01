import type { Meta, StoryObj } from "@storybook/react-vite";
import { fn } from "storybook/test";

import Button from "../../../components/atoms/Button";

import BottomBar, { BottomBarRow } from "./BottomBar";

const meta = {
  title: "User/Atoms/BottomBar",
  component: BottomBar,
  tags: ["autodocs"],
  parameters: { layout: "fullscreen" },
} satisfies Meta<typeof BottomBar>;

export default meta;
type Story = StoryObj<typeof meta>;

export const SingleButton: Story = {
  args: {
    children: (
      <Button variant="primary" onClick={fn()}>
        다음
      </Button>
    ),
  },
};

export const TwoButtonsRow: Story = {
  args: {
    children: (
      <BottomBarRow>
        <Button variant="outline" onClick={fn()}>
          이전
        </Button>
        <Button variant="primary" onClick={fn()}>
          저장
        </Button>
      </BottomBarRow>
    ),
  },
};

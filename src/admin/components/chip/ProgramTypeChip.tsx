import StatusChip from "./StatusChip";

interface ProgramTypeChipProps {
  programType: string | null;
}

/**
 * 사업단명 앞에 붙는 사업 유형(공익 활동 / 역량 활동) 배지입니다.
 *
 */
const ProgramTypeChip = ({ programType }: ProgramTypeChipProps) => {
  if (!programType) return null;

  return (
    <StatusChip variant={programType === "공익 활동" ? "info" : "pending"}>
      {programType}
    </StatusChip>
  );
};

export default ProgramTypeChip;

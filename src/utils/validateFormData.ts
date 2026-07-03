import type { ActivityLogFormData } from "../types/form";

interface ValidationRule {
  field: keyof ActivityLogFormData;
  message: string;
}

/**
 * 💡 공용 폼 검증 함수
 * @param data 현재 formData 객체
 * @param rules 검사하고 싶은 필드와 메시지 배열
 */
export function validateForm(
  data: ActivityLogFormData,
  rules: ValidationRule[],
): string[] {
  const errors: string[] = [];

  rules.forEach(({ field, message }) => {
    const value = data[field];

    // string 타입일 경우 공백 제거 후 빈 값 체크, boolean이나 object는 존재 여부 체크
    if (typeof value === "string") {
      if (!value.trim()) errors.push(message);
    } else if (value === undefined || value === null) {
      errors.push(message);
    }
  });

  return errors;
}

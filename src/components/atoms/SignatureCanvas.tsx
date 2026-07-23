import { useEffect, useRef } from "react";

import { sigBoxClass, sigClearClass } from "./classes";

interface SignatureCanvasProps {
  value: string;
  onChange: (dataUrl: string) => void;
}

/**
 * 손가락/마우스로 그리는 서명 캔버스. value가 data URL이면 마운트 시 복원한다.
 */
const SignatureCanvas = ({ value, onChange }: SignatureCanvasProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // 마운트 시 1회만 초기화 (서명 저장으로 인한 재초기화 방지)
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width;
    canvas.height = rect.height;

    ctx.lineWidth = 3;
    ctx.lineCap = "round";
    ctx.strokeStyle = "#000000";

    let isDrawing = false;

    const getPosition = (event: MouseEvent | TouchEvent) => {
      const canvasRect = canvas.getBoundingClientRect();
      if ("touches" in event) {
        if (event.touches.length === 0) return { x: 0, y: 0 };
        return {
          x: event.touches[0].clientX - canvasRect.left,
          y: event.touches[0].clientY - canvasRect.top,
        };
      }
      return {
        x: event.clientX - canvasRect.left,
        y: event.clientY - canvasRect.top,
      };
    };

    const startDrawing = (event: MouseEvent | TouchEvent) => {
      isDrawing = true;
      const position = getPosition(event);
      ctx.beginPath();
      ctx.moveTo(position.x, position.y);
    };

    const draw = (event: MouseEvent | TouchEvent) => {
      if (!isDrawing) return;
      event.preventDefault();
      const position = getPosition(event);
      ctx.lineTo(position.x, position.y);
      ctx.stroke();
    };

    const stopDrawing = () => {
      if (!isDrawing) return;
      isDrawing = false;
      onChange(canvas.toDataURL("image/png"));
    };

    canvas.addEventListener("mousedown", startDrawing);
    canvas.addEventListener("mousemove", draw);
    canvas.addEventListener("mouseup", stopDrawing);
    canvas.addEventListener("mouseleave", stopDrawing);
    canvas.addEventListener("touchstart", startDrawing, { passive: false });
    canvas.addEventListener("touchmove", draw, { passive: false });
    canvas.addEventListener("touchend", stopDrawing);

    if (value && value.startsWith("data:image")) {
      const image = new Image();
      image.onload = () =>
        ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
      image.src = value;
    }

    return () => {
      canvas.removeEventListener("mousedown", startDrawing);
      canvas.removeEventListener("mousemove", draw);
      canvas.removeEventListener("mouseup", stopDrawing);
      canvas.removeEventListener("mouseleave", stopDrawing);
      canvas.removeEventListener("touchstart", startDrawing);
      canvas.removeEventListener("touchmove", draw);
      canvas.removeEventListener("touchend", stopDrawing);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleClearButtonClick = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    onChange("");
  };

  return (
    <div className={sigBoxClass}>
      <canvas
        ref={canvasRef}
        className="w-full h-full rounded-2xl touch-none"
      />
      <button onClick={handleClearButtonClick} className={sigClearClass}>
        지우기
      </button>
    </div>
  );
};

export default SignatureCanvas;

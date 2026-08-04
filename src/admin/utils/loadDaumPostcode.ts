interface DaumPostcodeResult {
  roadAddress: string;
  jibunAddress: string;
  address: string;
}

declare global {
  interface Window {
    daum?: {
      Postcode: new (options: { oncomplete: (data: DaumPostcodeResult) => void }) => {
        open: () => void;
      };
    };
  }
}

const SCRIPT_SRC = "//t1.daumcdn.net/mapjsapi/bundle/postcode/prod/postcode.v2.js";

let loadPromise: Promise<void> | null = null;

// 다음(카카오) 우편번호 서비스 — 무료, API 키 불필요. 필요할 때(주소 검색 버튼 클릭 시)만
// 스크립트를 불러오고, 이후 재사용을 위해 모듈 스코프에 로딩 프로미스를 캐시해둔다.
export const loadDaumPostcodeScript = (): Promise<void> => {
  if (window.daum?.Postcode) return Promise.resolve();
  if (loadPromise) return loadPromise;

  loadPromise = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = SCRIPT_SRC;
    script.onload = () => resolve();
    script.onerror = () => {
      loadPromise = null;
      reject(new Error("주소 검색 스크립트를 불러오지 못했습니다."));
    };
    document.head.appendChild(script);
  });

  return loadPromise;
};

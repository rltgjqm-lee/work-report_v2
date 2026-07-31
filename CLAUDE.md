# CLAUDE.md

이 파일은 이 저장소에서 작업할 때 지켜야 할 규칙을 정리합니다.

## 프로젝트 개요

- React 19 + TypeScript + Vite + Tailwind 프론트엔드 (`src/`)
- Cloudflare Workers + D1 백엔드 (`worker/`)
- `src/admin/` : 관리자 콘솔
- `src/pages/main_pages/` : 활동일지 등 메인 사용자 플로우 페이지

## 코딩 컨벤션

### 배열 메서드 콜백 파라미터에 축약어 금지

`map`, `filter`, `find`, `forEach` 등 배열 메서드 콜백의 파라미터명은 축약하지 않고 온전한 이름을 씁니다.

- 금지: `item`, `state`, `event`, `btn`, `o`, `p` 같은 한 글자/모호한 축약어
- 대신: 배열이 담고 있는 실제 도메인 개념을 그대로 씁니다.

```ts
// Bad
organizations.map((o) => o.regionSido);
programs.filter((p) => p.projectType === projectType);

// Good
organizations.map((organization) => organization.regionSido);
programs.filter((program) => program.projectType === projectType);
```

### 이벤트 핸들러 / catch 파라미터에 축약어 금지

배열 메서드 콜백뿐 아니라 이벤트 핸들러와 `catch` 블록의 파라미터명도 축약하지 않습니다.

- 이벤트 핸들러(`onChange`, `onClick` 등) 콜백의 파라미터는 `e`가 아니라 `event`로 씁니다.
- `catch` 블록의 예외 파라미터는 `e`가 아니라 `error`로 씁니다.

```ts
// Bad
onChange={(e) => setName(e.target.value)}
try {
  ...
} catch (e) {
  setError(e instanceof Error ? e.message : "실패했습니다.");
}

// Good
onChange={(event) => setName(event.target.value)}
try {
  ...
} catch (error) {
  setError(error instanceof Error ? error.message : "실패했습니다.");
}
```

### 이벤트 핸들러 함수 이름 규칙

핸들러 함수명은 `handle + [대상 명사] + [이벤트 종류]` 구조로 짓습니다. `handleClick1`, `handleClick2`처럼 대상이 빠진 모호하고 중복되는 이름은 금지합니다.

- 제출 버튼 클릭: `handleSubmitButtonClick`
- 취소 버튼 클릭: `handleCancelButtonClick`
- 이메일 입력란 변경: `handleEmailInputChange` 또는 `handleEmailChange`

`on*`은 하위 컴포넌트로 이벤트를 전달하는 props(전달자)에 붙이는 이름입니다. 컴포넌트 내부에서 정의하는 핸들러 함수 자체에는 쓰지 않습니다.

```ts
// Bad
const handleClick1 = () => setModalOpen(true);
const handleClick2 = () => setModalOpen(false);

// Good
const handleAddButtonClick = () => setModalOpen(true);
const handleModalClose = () => setModalOpen(false);

// 하위 컴포넌트로 넘기는 props는 on* 그대로 유지
<OrganizationFormModal onClose={handleModalClose} onSaved={handleSaved} />
```

### 컴포넌트 폴더 구조 (atomic design)

`src/components/`는 `atoms/`, `molecule/`, `organism/`만 사용합니다. 새로운 최상위 카테고리 폴더(예: `appshell/`)를 임의로 만들지 않습니다.

- `atoms/`: 단일 요소 primitive (예: `Button.tsx`, `TextInput.tsx`, 스타일 상수)
- `molecule/`: atom 여러 개를 조합한 작은 단위 (예: `LabeledInput.tsx`, `ConfirmModal.tsx`)
- `organism/`: 더 큰 구조적 조합 (예: `PdfTemplate.tsx`)
- `src/pages/`: 라우트 단위 페이지 컴포넌트

새 파일을 어디에 둘지 애매하면 먼저 물어보고 진행합니다.

### admin 콘솔의 데이터 조회: `src/admin/api/admin/*.ts`에 다 모은다

admin 콘솔은 `useState`/`useEffect` + 수동 `refresh()` 대신 TanStack Query로 데이터를
조회합니다. 도메인 하나당 파일 하나(`src/admin/api/admin/<도메인>.ts`)에 다음 네 가지를
전부 같이 둡니다 — fetch 함수, (단일 소비자면) 그 응답 타입, 쿼리 키 팩토리, `queryOptions()`.
별도로 `query/` 폴더나 타입 전용 파일을 만들지 않습니다 — 이 도메인을 다루려면 결국 이
파일 하나만 열면 되게 하기 위함입니다.

```ts
// src/admin/api/admin/safetyAlerts.ts
import { queryOptions } from "@tanstack/react-query";
import { request } from "../client";

export const listSafetyAlerts = () => request<SafetyAlert[]>("/api/safety-alerts");

export const safetyAlertsKeys = {
  all: ["safety-alerts"] as const,
};

export const safetyAlertsQueryOptions = queryOptions({
  queryKey: safetyAlertsKeys.all,
  queryFn: listSafetyAlerts,
});

export const sendTestSafetyAlert = (data: { ... }) => request(...); // 뮤테이션 fetch 함수도 같이
```

- **타입**: `src/admin/types.ts`에는 여러 API 파일·여러 페이지·여러 컴포넌트에서 같이 쓰는
  진짜 공유 도메인 모델(`Participant`, `Program`, `DemandSite` 등)만 둡니다. 소비자가 API 함수
  하나뿐인 타입(그 함수의 응답 타입 등)은 `types.ts`에 두지 않고 그 API 파일 안에서 직접
  `export`합니다. 기존에 `types.ts`에 있던 타입들은 점진적으로 이 기준에 맞춰 정리합니다 —
  한 번에 다 옮기지 않고, 그 타입/API를 만지는 김에 하나씩 옮깁니다.
- **쿼리 키**: 여러 도메인 키를 한 중앙 파일에 다 모아두지 않습니다 — id처럼 파라미터가
  들어가는 순간 상수 배열로는 표현이 안 되고 함수가 필요해지는데, 그 함수를 다른 도메인
  키들과 한 객체에 섞어두면 오히려 지저분해집니다. 도메인마다 자기 키를 그 API 파일 안에서
  직접 소유하게 합니다. id로 상세 조회하는 쿼리가 생기면 같은 파일에
  `detail: (id) => [...xxxKeys.all, id] as const` 형태로 추가합니다 — `all`을 prefix로 두면
  `invalidateQueries({ queryKey: xxxKeys.all })` 한 번으로 그 도메인 전체(목록+상세 전부)를
  무효화할 수 있습니다.
- **쿼리 옵션**: 페이지/컴포넌트에서는 `useQuery(safetyAlertsQueryOptions)`로 바로 씁니다.
  이 조회를 쓰는 곳이 하나뿐이어도 만들어 둡니다 — 나중에 다른 페이지가 같은 데이터를 쓸 때
  캐싱 옵션(`staleTime` 등)을 이 한 파일에서만 튜닝하면 되게 하기 위함입니다.
- **뮤테이션(생성/수정/삭제)은 이 파일에서 fetch 함수만 export하고, `useMutation` 자체는
  페이지 컴포넌트 안에서 직접 선언합니다.** `onSuccess`에서 그 페이지의 로컬 state(입력값
  초기화, 결과 메시지 등)를 같이 건드리는 경우가 많아 재사용성이 낮으므로, 쿼리 옵션처럼
  미리 만들어두지 않습니다:
  `useMutation({ mutationFn, onSuccess: () => queryClient.invalidateQueries({ queryKey: xxxKeys.all }) })`.
  커스텀 훅(`useXxx.ts`)으로 감싸지도 않습니다 — 페이지/컴포넌트가 `useQuery`/`useMutation`을
  직접 호출하는 스타일을 유지합니다.

레퍼런스: `src/admin/pages/LoginHistoryPage.tsx`, `src/admin/pages/DisasterMessagesPage.tsx`,
`src/admin/AdminApp.tsx`의 `QueryClientProvider` 설정.

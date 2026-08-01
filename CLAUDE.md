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
- **뮤테이션(생성/수정/삭제)은 "critical"과 "UI 한정"을 분리합니다** (TkDodo,
  [Mastering Mutations in React Query](https://tkdodo.eu/blog/mastering-mutations-in-react-query)).
  `useMutation`은 정의 시점 콜백(`useMutation({ onSuccess })`)과 호출 시점 콜백
  (`mutate(variables, { onSuccess })`)을 둘 다 실행합니다 — 정의 쪽이 먼저 실행됩니다.
  - **critical** (이 뮤테이션이 성공하면 어느 화면에서 호출하든 항상 해야 하는 것 — 캐시
    무효화)은 API 파일에 `mutationOptions()`로 만들어 export합니다. `queryClient`는
    `useQueryClient()`로 컴포넌트 안에서만 얻을 수 있으므로, 이 export는
    `(queryClient: QueryClient) => mutationOptions({...})` 형태의 팩토리 함수입니다.
  - **UI 한정** (그 화면에서만 의미 있는 것 — alert 메시지, 폼 리셋, 리다이렉트)은
    페이지 컴포넌트의 `mutate(variables, { onSuccess, onError })` 호출부에 둡니다.

```ts
// src/admin/api/admin/participants.ts
export const deleteParticipantMutationOptions = (queryClient: QueryClient) =>
  mutationOptions({
    mutationFn: ({ programId, participantId }: DeleteParticipantVariables) =>
      deleteParticipant(programId, participantId),
    onSuccess: (_data, variables) => {
      // critical: 이 참여자가 속한 사업단의 상세를 무효화 — 어디서 호출하든 항상 필요
      queryClient.invalidateQueries({
        queryKey: programKeys.detail(variables.programId),
      });
    },
  });
```

```tsx
// ParticipantsPage.tsx
const deleteParticipantMutation = useMutation(
  deleteParticipantMutationOptions(queryClient),
);

deleteParticipantMutation.mutate(variables, {
  // UI 한정: 이 화면에서 삭제 성공을 어떻게 알릴지
  onSuccess: () => alert(`'${row.name}' 님을 삭제했습니다.`),
  onError: (error) => alert(error instanceof Error ? error.message : "삭제에 실패했습니다."),
});
```

커스텀 훅(`useXxx.ts`)으로 감싸지 않습니다 — 페이지/컴포넌트가 `useQuery`/`useMutation`을
직접 호출하는 스타일을 유지합니다. mutationFn의 변수 타입은 그 뮤테이션과 같은 API 파일에
인터페이스로 export합니다(예: `DeleteParticipantVariables`).

레퍼런스: `src/admin/pages/LoginHistoryPage.tsx`, `src/admin/pages/DisasterMessagesPage.tsx`,
`src/admin/pages/ParticipantsPage.tsx` + `src/admin/api/admin/participants.ts`
(critical/UI 분리 예시), `src/admin/AdminApp.tsx`의 `QueryClientProvider` 설정.

같은 규칙이 참여자 앱(`src/pages/main_pages/`)의 데이터 조회에도 그대로 적용됩니다 —
그 앱의 API 파일 위치는 `src/utils/<도메인>Api.ts`(예: `affiliationsApi.ts`,
`attendanceApi.ts`)이고, 그 안에 fetch 함수 + 쿼리 키 + `queryOptions()`를 같이 둡니다.
`QueryClientProvider`는 `src/MobileApp.tsx`에 있습니다.

### 파라미터가 있는 쿼리: `enabled`/`select`도 팩토리 안에 접어넣는다

`demandSitesQueryOptions(programId)`처럼 파라미터를 받는 쿼리 옵션 팩토리를 만들 때, 그
쿼리가 조건부로만 실행되어야 하거나(`enabled`) 응답을 그 화면이 쓰는 모양으로 다듬어야
한다면(`select`), 호출하는 페이지에서
`{ ...xxxQueryOptions(...), enabled: ..., select: ... }`처럼 스프레드해서 오버라이드하지
않습니다. 소비자가 하나뿐인 이상 그 페이지만을 위한 오버라이드를 페이지 쪽에 흩어놓을
이유가 없으니, 팩토리 함수 자체에 다 넣습니다.

- **`enabled`**: 파라미터 타입을 `number | undefined`처럼 받고, 팩토리 안에서
  `enabled: !!participantId`로 계산합니다. `queryKey`/`queryFn`에 쓸 fallback 값(`?? 0`
  등)도 같이 팩토리 안에서 처리해서, 페이지는 `useQuery(xxxQueryOptions(participantId))`
  하나로 끝나게 합니다.
- **`select`**: `{ ...data, extra: ... }`처럼 원본을 통째로 스프레드하지 않고, 그 화면이
  실제로 쓰는 필드만 이름을 붙여 명시적으로 리턴합니다. 원본 타입을 그대로 노출하면
  쓰지도 않는 필드까지 소비자가 안고 가야 하고, 나중에 원본 필드가 바뀌면 상관없는
  화면까지 타입 에러가 납니다.
- `select`가 원본과 다른 모양을 리턴하면, 그 결과 타입을 같은 파일에 별도
  `export type`으로 만들어 페이지가 원본 응답 타입 대신 그 타입을 참조하게 합니다.

```ts
// src/utils/attendanceApi.ts
export type IdentifiedRegistration = {
  participantId: number;
  status: IdentifiedParticipant["status"];
  leaveEnd: string | null;
  program: IdentifiedParticipant["program"];
  orgAddress: string;
};

export const identifyParticipantQueryOptions = (
  programId: number | undefined,
  name: string | undefined,
) =>
  queryOptions({
    queryKey: identifyParticipantKeys.byProgramAndName(programId ?? 0, name ?? ""),
    queryFn: () => identifyParticipant(programId as number, name as string),
    enabled: !!programId && !!name,
    select: (identified: IdentifiedParticipant): IdentifiedRegistration => ({
      participantId: identified.participantId,
      status: identified.status,
      leaveEnd: identified.leaveEnd,
      program: identified.program,
      orgAddress: [identified.organization?.regionSido, identified.organization?.regionSigungu]
        .filter(Boolean)
        .join(" "),
    }),
  });
```

```tsx
// RegistrationConfirmPage.tsx — 페이지는 오버라이드 없이 그대로 쓴다
const { data: identified, isPending, isError, error } = useQuery(
  identifyParticipantQueryOptions(formData.programId, formData.userName),
);
```

### `useQuery` 결과는 호출부에서 바로 구조분해한다

`const xxxQuery = useQuery(...)`로 결과 객체를 통째로 들고 있다가 `xxxQuery.data`,
`xxxQuery.isPending`, `xxxQuery.isError`를 여기저기서 반복해서 찍지 않습니다. 호출 시점에
바로 의미 있는 이름으로 구조분해합니다.

```tsx
const {
  data: identified,
  isPending: isIdentifyPending,
  isError: isIdentifyError,
  error: identifyError,
} = useQuery(identifyParticipantQueryOptions(formData.programId, formData.userName));
```

한 화면에 쿼리가 여러 개면 이 접두사(`isIdentifyPending` 등)가 어떤 쿼리의 상태인지
구분해줍니다.

레퍼런스: `src/utils/attendanceApi.ts`(`identifyParticipantQueryOptions`의 `enabled`/`select`
예시), `src/pages/main_pages/RegistrationConfirmPage.tsx`(구조분해 소비 예시).

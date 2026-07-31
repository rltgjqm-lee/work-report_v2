---
description: admin 콘솔 페이지 하나를 TanStack Query로 마이그레이션
---

`$ARGUMENTS`로 지정된 admin 페이지(또는 인자가 없으면 사용자에게 어떤 페이지인지 먼저 물어본다)를
`useState`/`useEffect` + 수동 `refresh()` 패턴에서 TanStack Query로 옮긴다.

**레퍼런스**: `src/admin/pages/LoginHistoryPage.tsx`, `src/admin/pages/DisasterMessagesPage.tsx`
(이미 마이그레이션된 예시), `src/admin/AdminApp.tsx`의 `QueryClientProvider` 설정,
`src/admin/api/admin/safetyAlerts.ts`(fetch 함수+쿼리 키+쿼리 옵션이 한 파일에 있는 예시),
`src/admin/api/admin/participants.ts` + `src/admin/pages/ParticipantsPage.tsx`
(뮤테이션 critical/UI 분리 예시). 막히면 이 파일들을 먼저 읽고 그대로 따라간다. 자세한
레이어 설명은 CLAUDE.md의 "admin 콘솔의 데이터 조회" 항목 참고.

## 진행 순서

1. 대상 페이지와 그 페이지가 쓰는 API 함수(`src/admin/api/admin/*.ts`)를 읽는다.
2. **조회**: `useState` + `useEffect(() => fn().then(setState), [deps])`를 없앤다. 별도
   폴더나 파일을 새로 만들지 않고, 그 fetch 함수가 있는 **같은 `api/admin/<도메인>.ts` 파일에**
   다음을 추가한다.
   - 쿼리 키 팩토리: `export const xxxKeys = { all: ["xxx"] as const }`. 여러 도메인 키를
     섞은 중앙 파일에 두지 않는다 — 도메인마다 자기 키를 소유한다. id로 상세 조회하는 쿼리가
     필요하면 `detail: (id) => [...xxxKeys.all, id] as const` 형태로 같이 추가한다.
   - 쿼리 옵션: `export const xxxQueryOptions = queryOptions({ queryKey: xxxKeys.all, queryFn: fn })`.
     소비자가 이 페이지 하나뿐이어도 만든다.
   - 페이지에서는 `useQuery(xxxQueryOptions)`로 쓴다. 커스텀 훅(`useXxx.ts`)으로 감싸지
     않는다 — 페이지/컴포넌트가 `useQuery`를 직접 호출하는 스타일이다.
3. **변경(생성/수정/삭제)**: "critical"과 "UI 한정"을 분리한다 (TkDodo,
   [Mastering Mutations in React Query](https://tkdodo.eu/blog/mastering-mutations-in-react-query)).
   `useMutation`은 정의 시점 콜백과 호출 시점 콜백(`mutate(variables, { onSuccess })`)을
   둘 다 실행한다 — 정의 쪽이 먼저 실행된다.
   - **critical**(이 뮤테이션이 성공하면 어느 화면에서 호출하든 항상 해야 하는 것 — 보통
     캐시 무효화)은 같은 `api/admin/<도메인>.ts` 파일에 `mutationOptions()`로 만들어
     export한다. `queryClient`는 컴포넌트 안에서만 얻을 수 있으므로
     `(queryClient: QueryClient) => mutationOptions({...})` 팩토리 형태로 만든다.
     mutationFn의 변수 타입은 같은 파일에 인터페이스로 export한다
     (`export interface XxxMutationVariables { ... }`).
   - **UI 한정**(그 화면에서만 의미 있는 것 — alert 메시지, 폼 리셋, 리다이렉트)은 페이지의
     `mutate(variables, { onSuccess, onError })` 호출부에 그대로 둔다.
   - 페이지에서는 `useMutation(xxxMutationOptions(queryClient))`로 훅을 만들고,
     `.mutate(variables, { onSuccess, onError })`로 호출한다. 커스텀 훅(`useXxx.ts`)으로
     감싸지 않는다.
   - **가장 중요한 부분**: 지금 코드는 자식 모달이 저장 성공 후
     `onSaved={() => { close(); onChanged(); }}` 식으로 부모의 `refresh()`를 호출하도록
     콜백을 계속 위로 릴레이하는 구조다. 이 콜백 릴레이를 걷어내고, mutationOptions의
     critical `onSuccess`에서 `queryClient.invalidateQueries({ queryKey: xxxKeys.all })`로
     대체한다. 여러 컴포넌트를 거치는 `onChanged`/`onSaved` prop이 이 목적 하나만을 위해
     존재했다면 그 prop 자체를 지운다.
4. **타입**: 이 API의 응답/요청 타입 소비자가 하나뿐이면(CLAUDE.md "타입 위치" 규칙),
   `src/admin/types.ts`에서 해당 API 파일로 옮긴다. 여러 곳에서 쓰는 공유 도메인 타입이면
   `types.ts`에 그대로 둔다.
5. **폴링은 기본값이 아니다**: `refetchInterval`은 EscapesPage의 실시간 위치처럼 화면이
   계속 갱신돼야 하는 경우에만 쓴다. 단순 목록/상세 조회 페이지에는 추가하지 않는다.
6. React를 명시적으로 import하지 않는다(React 19 + 새 JSX transform). 컴포넌트는 이
   저장소의 기존 스타일대로 화살표 함수 + props 구조분해로 작성한다 (`React.FC` 금지).

## 완료 후 확인

- `npx tsc -b --force` — 타입 에러 없어야 함
- `npx eslint <바꾼 파일들>` — 새 경고/에러 없어야 함
- 변경 요약과 함께 커밋 여부를 사용자에게 물어본다 (먼저 커밋하지 않는다)

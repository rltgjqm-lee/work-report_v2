---
description: admin 콘솔 페이지 하나를 TanStack Query로 마이그레이션
---

`$ARGUMENTS`로 지정된 admin 페이지(또는 인자가 없으면 사용자에게 어떤 페이지인지 먼저 물어본다)를
`useState`/`useEffect` + 수동 `refresh()` 패턴에서 TanStack Query로 옮긴다.

**레퍼런스**: `src/admin/pages/LoginHistoryPage.tsx` (이미 마이그레이션된 예시),
`src/admin/AdminApp.tsx`의 `QueryClientProvider` 설정, `src/admin/queryKeys.ts`.
막히면 이 세 파일을 먼저 읽고 그대로 따라간다.

## 진행 순서

1. 대상 페이지와 그 페이지가 쓰는 API 함수(`src/admin/api/admin/*.ts`)를 읽는다.
2. **조회**: `useState` + `useEffect(() => fn().then(setState), [deps])`를
   `useQuery({ queryKey: queryKeys.xxx, queryFn: fn })`로 바꾼다.
   - 커스텀 훅(`useXxx.ts`)으로 감싸지 않는다 — 이 저장소는 페이지/컴포넌트에서
     `useQuery`를 직접 호출하는 스타일이다 (LoginHistoryPage 참고).
   - 쿼리 키는 `src/admin/queryKeys.ts`의 `queryKeys` 객체에 추가하고 그걸 참조한다.
     리터럴 배열을 컴포넌트/훅 안에 직접 쓰지 않는다.
3. **변경(생성/수정/삭제)**: `useMutation({ mutationFn: fn })`으로 바꾼다.
   - **가장 중요한 부분**: 지금 코드는 자식 모달이 저장 성공 후
     `onSaved={() => { close(); onChanged(); }}` 식으로 부모의 `refresh()`를 호출하도록
     콜백을 계속 위로 릴레이하는 구조다. 이 콜백 릴레이를 걷어내고,
     mutation의 `onSuccess`에서 `queryClient.invalidateQueries({ queryKey: queryKeys.xxx })`로
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

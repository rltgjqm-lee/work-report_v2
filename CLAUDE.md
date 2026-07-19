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

### 컴포넌트 폴더 구조 (atomic design)

`src/components/`는 `atoms/`, `molecule/`, `organism/`만 사용합니다. 새로운 최상위 카테고리 폴더(예: `appshell/`)를 임의로 만들지 않습니다.

- `atoms/`: 단일 요소 primitive (예: `Button.tsx`, `TextInput.tsx`, 스타일 상수)
- `molecule/`: atom 여러 개를 조합한 작은 단위 (예: `LabeledInput.tsx`, `ConfirmModal.tsx`)
- `organism/`: 더 큰 구조적 조합 (예: `PdfTemplate.tsx`)
- `src/pages/`: 라우트 단위 페이지 컴포넌트

새 파일을 어디에 둘지 애매하면 먼저 물어보고 진행합니다.

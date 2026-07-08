import { useMemo, useState } from "react";

export const usePagination = <T>(items: T[], perPage: number) => {
  const [page, setPage] = useState(1);
  const totalPages = Math.max(1, Math.ceil(items.length / perPage));
  const clampedPage = Math.min(Math.max(1, page), totalPages);

  const pageItems = useMemo(
    () =>
      items.slice(
        (clampedPage - 1) * perPage,
        (clampedPage - 1) * perPage + perPage,
      ),
    [items, clampedPage, perPage],
  );

  return { page: clampedPage, totalPages, pageItems, setPage };
};

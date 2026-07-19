interface PaginationProps {
  page: number;
  totalPages: number;
  onChange: (page: number) => void;
}

const buildPageNumbers = (
  current: number,
  total: number,
): (number | "ellipsis")[] => {
  if (total <= 7) return Array.from({ length: total }, (_, index) => index + 1);
  const numbers: (number | "ellipsis")[] = [1];

  if (current > 3) numbers.push("ellipsis");

  for (
    let i = Math.max(2, current - 1);
    i <= Math.min(total - 1, current + 1);
    i++
  ) {
    numbers.push(i);
  }

  if (current < total - 2) numbers.push("ellipsis");
  numbers.push(total);

  return numbers;
};

const pageBtnBase =
  "min-w-[30px] h-[30px] border rounded-[2px] text-xs font-semibold cursor-pointer";

const Pagination = ({ page, totalPages, onChange }: PaginationProps) => {
  const pages = buildPageNumbers(page, totalPages);

  return (
    <div className="flex items-center justify-center gap-1.5 py-4 px-5">
      <button
        className={`${pageBtnBase} border-[#d7dbe1] bg-white text-[#374151] disabled:opacity-40 disabled:cursor-not-allowed`}
        onClick={() => onChange(page - 1)}
        disabled={page <= 1}
      >
        ‹
      </button>
      {pages.map((pageNumber, index) =>
        pageNumber === "ellipsis" ? (
          <span
            key={`ellipsis-${index}`}
            className="text-[#9aa1ab] text-xs px-1"
          >
            …
          </span>
        ) : (
          <button
            key={pageNumber}
            onClick={() => onChange(pageNumber)}
            className={`${pageBtnBase} ${
              pageNumber === page
                ? "bg-[#1e3a5f] border-[#1e3a5f] text-white"
                : "bg-white border-[#d7dbe1] text-[#374151]"
            }`}
          >
            {pageNumber}
          </button>
        ),
      )}
      <button
        className={`${pageBtnBase} border-[#d7dbe1] bg-white text-[#374151] disabled:opacity-40 disabled:cursor-not-allowed`}
        onClick={() => onChange(page + 1)}
        disabled={page >= totalPages}
      >
        ›
      </button>
    </div>
  );
};

export default Pagination;

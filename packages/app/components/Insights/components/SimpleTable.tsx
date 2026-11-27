import { SimpleTableOutputType } from "@koh/common";
import { ChevronLeft, ChevronRight } from "lucide-react";
import React, { ReactElement } from "react";
import { SetStateAction } from "react";
import { Dispatch } from "react";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
} from "@/components/ui/pagination";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface SimpleTableTypes {
  output: SimpleTableOutputType;
  currentPage: number;
  setPage: Dispatch<SetStateAction<number>>;
}

const PAGE_SIZE = 6;
const jumpTitle = {
  jumpPrev: "Previous 5 Pages",
  jumpNext: "Next 5 Pages",
};

type PagerItem = number | "jumpPrev" | "jumpNext";

// antd's pager layout, the same function as in Settings/CourseRoster.tsx: up
// to 7 pages all show; beyond that, the current page +-2 (5 pages at the
// ends), the first and last page, and a "jump 5 pages" button where pages
// are left out
function pagerItems(page: number, count: number): PagerItem[] {
  const range = (from: number, to: number) =>
    Array.from({ length: to - from + 1 }, (_, i) => from + i);
  if (count <= 7) return range(1, count);
  let left = Math.max(1, page - 2);
  let right = Math.min(page + 2, count);
  if (page - 1 <= 2) right = 5;
  if (count - page <= 2) left = count - 4;
  const items: PagerItem[] = range(left, right);
  if (page - 1 >= 4 && page !== 3) items.unshift("jumpPrev");
  if (count - page >= 4 && page !== count - 2) items.push("jumpNext");
  if (left !== 1) items.unshift(1);
  if (right !== count) items.push(count);
  return items;
}

export const SimpleTable = ({
  output,
  currentPage,
  setPage,
}: SimpleTableTypes): ReactElement => {
  // antd shows one (empty) page even with no students
  const pageCount = Math.max(1, Math.ceil(output.totalStudents / PAGE_SIZE));
  const goTo = (p: number) => (e: React.MouseEvent) => {
    e.preventDefault();
    if (p >= 1 && p <= pageCount) setPage(p);
  };
  const dimmed = (off: boolean) =>
    off ? "pointer-events-none opacity-50" : "";

  return (
    <div>
      {/* The server sends antd-style columns ({ title, dataIndex, key }) */}
      <Table>
        <TableHeader>
          <TableRow>
            {output.columns.map((col) => (
              // antd's table header: grey, 16px padding
              <TableHead
                key={col.key}
                className="h-auto bg-[#fafafa] p-4 font-medium text-[rgba(0,0,0,0.85)]"
              >
                {col.title}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {output.dataSource.length === 0 ? (
            <TableRow>
              <TableCell
                colSpan={output.columns.length}
                className="text-center text-muted-foreground"
              >
                No data
              </TableCell>
            </TableRow>
          ) : (
            output.dataSource.map((row, i) => (
              <TableRow key={row.key ?? i}>
                {output.columns.map((col) => (
                  <TableCell key={col.key} className="p-4">
                    {row[col.dataIndex]}
                  </TableCell>
                ))}
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
      <Pagination
        aria-label="Most active students pages"
        className="my-4 justify-start"
      >
        <PaginationContent className="flex-wrap">
          <PaginationItem>
            <PaginationLink
              href="#"
              aria-label="Previous Page"
              aria-disabled={currentPage === 1}
              tabIndex={currentPage === 1 ? -1 : undefined}
              className={dimmed(currentPage === 1)}
              onClick={goTo(currentPage - 1)}
            >
              <ChevronLeft className="size-4" />
            </PaginationLink>
          </PaginationItem>
          {pagerItems(currentPage, pageCount).map((p) => (
            <PaginationItem key={p}>
              {p === "jumpPrev" || p === "jumpNext" ? (
                <PaginationLink
                  href="#"
                  title={jumpTitle[p]}
                  aria-label={jumpTitle[p]}
                  className="text-muted-foreground"
                  onClick={goTo(
                    p === "jumpPrev"
                      ? Math.max(1, currentPage - 5)
                      : Math.min(pageCount, currentPage + 5)
                  )}
                >
                  •••
                </PaginationLink>
              ) : (
                <PaginationLink
                  href="#"
                  isActive={p === currentPage}
                  onClick={goTo(p)}
                >
                  {p}
                </PaginationLink>
              )}
            </PaginationItem>
          ))}
          <PaginationItem>
            <PaginationLink
              href="#"
              aria-label="Next Page"
              aria-disabled={currentPage === pageCount}
              tabIndex={currentPage === pageCount ? -1 : undefined}
              className={dimmed(currentPage === pageCount)}
              onClick={goTo(currentPage + 1)}
            >
              <ChevronRight className="size-4" />
            </PaginationLink>
          </PaginationItem>
        </PaginationContent>
      </Pagination>
    </div>
  );
};

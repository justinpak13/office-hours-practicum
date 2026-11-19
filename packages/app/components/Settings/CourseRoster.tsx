import { API } from "@koh/api-client";
import { Role } from "@koh/common";
import {
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  Loader2,
  Search,
} from "lucide-react";
import AvatarWithInitals from "../common/AvatarWithInitials";
import { useState } from "react";
import { ReactElement } from "react";
import styled from "styled-components";
import useSWR from "swr";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
} from "@/components/ui/pagination";
import { Separator } from "@/components/ui/separator";

type CourseRosterProps = { courseId: number };

type RenderTableProps = {
  courseId: number;
  role: Role;
  listTitle: string;
  displaySearchBar: boolean;
  searchPlaceholder: string;
};

const PAGE_SIZE = 50;
const jumpTitle = {
  jumpPrev: "Previous 5 Pages",
  jumpNext: "Next 5 Pages",
};

const CourseRosterComponent = styled.div`
  margin-left: auto;
  margin-right: auto;
`;

const TableBackground = styled.div`
  background-color: white;
`;

export default function CourseRoster({
  courseId,
}: CourseRosterProps): ReactElement {
  return (
    <CourseRosterComponent>
      <h1>Course Roster</h1>
      <Alert className="mb-4 rounded-sm border-[#ffe58f] bg-[#fffbe6] [&>svg]:text-[#faad14]">
        <CircleAlert className="size-4" />
        {/* The title is a bare heading, so size it to match the old 16px title */}
        <AlertTitle className="text-base">Notice</AlertTitle>
        <AlertDescription>
          Please note that the roster will update as users log into the office
          hours app. There is no direct user synchronization with the Admin
          Portal.
        </AlertDescription>
      </Alert>
      <RenderTable
        courseId={courseId}
        role={Role.PROFESSOR}
        listTitle={"Professors"}
        displaySearchBar={false}
        searchPlaceholder=""
      />
      <br />
      <RenderTable
        courseId={courseId}
        role={Role.TA}
        listTitle={"Teaching Assistants"}
        displaySearchBar={true}
        searchPlaceholder="Search TAs"
      />
      <br />
      <RenderTable
        courseId={courseId}
        role={Role.STUDENT}
        listTitle={"Students"}
        displaySearchBar={true}
        searchPlaceholder="Search students"
      />
      <br />
      <Separator className="my-6" />
    </CourseRosterComponent>
  );
}

type PagerItem = number | "jumpPrev" | "jumpNext";

// Same layout as the old pager: up to 7 pages all show; beyond that, the
// current page +-2 (5 pages at the ends), the first and last page, and a
// "jump 5 pages" button where pages are left out
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

function RenderTable({
  courseId,
  role,
  listTitle,
  displaySearchBar,
  searchPlaceholder,
}: RenderTableProps): ReactElement {
  const [page, setPage] = useState(1);
  const [input, setInput] = useState("");
  const [search, setSearch] = useState("");
  const handleInput = (event) => {
    event.preventDefault();
    setInput(event.target.value);
  };
  const handleSearch = (event) => {
    event.preventDefault();
    setSearch(event.target.value);
    setPage(1);
  };
  const { data } = useSWR(
    `${role}/${page}/${search}`,
    async () => await API.course.getUserInfo(courseId, page, role, search)
  );
  if (!data) {
    return (
      <div
        role="status"
        aria-live="polite"
        aria-busy="true"
        className="flex flex-col items-center gap-2 py-4 text-primary"
      >
        <Loader2 className="size-8 animate-spin" />
        <span>Loading...</span>
      </div>
    );
  } else {
    const pageCount = Math.ceil(data.total / PAGE_SIZE);
    const goTo = (p: number) => (e: React.MouseEvent) => {
      e.preventDefault();
      if (p >= 1 && p <= pageCount) setPage(p);
    };
    return (
      <>
        <TableBackground>
          <div style={{ backgroundColor: "#f0f0f0", height: "56px" }}>
            <h3 style={{ position: "relative", left: "10px", top: "14px" }}>
              {listTitle}
            </h3>
          </div>
          {displaySearchBar && (
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="pl-9"
                placeholder={searchPlaceholder}
                value={input}
                onChange={handleInput}
                onKeyDown={(e) => {
                  // Enter that confirms an IME composition isn't a search
                  const composing =
                    e.nativeEvent.isComposing || e.keyCode === 229;
                  if (e.key === "Enter" && !composing) handleSearch(e);
                }}
              />
            </div>
          )}
          <ul className="m-0 list-none divide-y rounded-sm border p-0">
            {data.users.length === 0 && (
              <li className="px-6 py-3 text-center text-muted-foreground">
                No data
              </li>
            )}
            {data.users.map((item) => (
              // Wraps at 576px and narrower, so a long name and email fit on phones
              <li
                key={item.id}
                className="flex items-center justify-between px-6 py-3 max-[576px]:flex-wrap"
              >
                <div className="flex min-w-0 items-center gap-4">
                  <AvatarWithInitals name={item.name} className="shrink-0" />
                  <span className="min-w-0 [overflow-wrap:anywhere]">
                    {item.name}
                  </span>
                </div>
                {/* Never squeezed by a long name; breaks only if the email
                    alone is too wide, leaving room for the avatar */}
                <div className="max-w-[calc(100%-4rem)] shrink-0 break-all max-[576px]:max-w-full">
                  {item.email}
                </div>
              </li>
            ))}
          </ul>
        </TableBackground>
        <br />
        {data.total > PAGE_SIZE && (
          <Pagination aria-label={`${listTitle} pages`} className="justify-end">
            {/* Wraps onto more lines on narrow screens, still right-aligned */}
            <PaginationContent className="flex-wrap justify-end">
              <PaginationItem>
                <PaginationLink
                  href="#"
                  aria-label="Previous Page"
                  onClick={goTo(page - 1)}
                  aria-disabled={page === 1}
                  tabIndex={page === 1 ? -1 : undefined}
                  className={page === 1 ? "pointer-events-none opacity-50" : ""}
                >
                  <ChevronLeft className="size-4" />
                </PaginationLink>
              </PaginationItem>
              {pagerItems(page, pageCount).map((p) => (
                <PaginationItem key={p}>
                  {p === "jumpPrev" || p === "jumpNext" ? (
                    <PaginationLink
                      href="#"
                      title={jumpTitle[p]}
                      aria-label={jumpTitle[p]}
                      className="text-muted-foreground"
                      onClick={goTo(
                        p === "jumpPrev"
                          ? Math.max(1, page - 5)
                          : Math.min(pageCount, page + 5)
                      )}
                    >
                      •••
                    </PaginationLink>
                  ) : (
                    <PaginationLink
                      href="#"
                      isActive={p === page}
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
                  onClick={goTo(page + 1)}
                  aria-disabled={page === pageCount}
                  tabIndex={page === pageCount ? -1 : undefined}
                  className={
                    page === pageCount ? "pointer-events-none opacity-50" : ""
                  }
                >
                  <ChevronRight className="size-4" />
                </PaginationLink>
              </PaginationItem>
            </PaginationContent>
          </Pagination>
        )}
      </>
    );
  }
}

import { API } from "@koh/api-client";
import { GetCourseOverridesRow, Role } from "@koh/common";
import { ChevronLeft, ChevronRight, Loader2, Trash2 } from "lucide-react";
import React, { ReactElement, useState } from "react";
import { toast } from "sonner";
import styled from "styled-components";
import useSWR from "swr";
import { useCourse } from "../../hooks/useCourse";
import AddOverrideInput from "./AddOverrideInput";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
} from "@/components/ui/pagination";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type CourseOverrideSettingsProps = { courseId: number };

// Matches the old table's pager: 10 rows a page
const PAGE_SIZE = 10;

const formattedRoles = {
  student: "Student",
  ta: "TA",
  professor: "Professor",
};

const jumpTitle = {
  jumpPrev: "Previous 5 Pages",
  jumpNext: "Next 5 Pages",
};

type PagerItem = number | "jumpPrev" | "jumpNext";

// NOTE: copied from CourseRoster.tsx (same as the old antd pager): up to 7
// pages all show; beyond that, the current page +-2 (5 pages at the ends),
// the first and last page, and a "jump 5 pages" button where pages are left out
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

// Like the old Popconfirm: stays open with a spinner until the delete
// finishes, and stays open if it fails. Outside the page component so a
// refetch doesn't remount it.
function DeleteOverrideButton({
  row,
  onDelete,
}: {
  row: GetCourseOverridesRow;
  onDelete: (row: GetCourseOverridesRow) => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  return (
    <AlertDialog open={open} onOpenChange={(o) => !busy && setOpen(o)}>
      <AlertDialogTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          aria-label={`Delete override for ${row.name}`}
          data-cy={`delete-override-${row.email}`}
          className="text-red-600 hover:text-red-600"
        >
          <Trash2 />
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Remove override for {row.name}?</AlertDialogTitle>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={busy}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            className={buttonVariants({ variant: "destructive" })}
            disabled={busy}
            data-cy="confirm-delete-override"
            onClick={async (e) => {
              e.preventDefault(); // close only once the delete has worked
              setBusy(true);
              try {
                await onDelete(row);
                setOpen(false);
              } catch (e) {
                toast.error(
                  e.response?.data?.message || "Failed to delete the override"
                );
              } finally {
                setBusy(false);
              }
            }}
          >
            {busy && <Loader2 className="animate-spin" />}
            Remove
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

const OverrideContents = styled.div`
  margin-left: auto;
  margin-right: auto;
  padding-top: 50px;
`;

export default function CourseOverrideSettings({
  courseId,
}: CourseOverrideSettingsProps): ReactElement {
  const { data, mutate } = useSWR(`/api/v1/courses/course_override`, async () =>
    API.course.getCourseOverrides(courseId)
  );

  const { course, mutateCourse } = useCourse(courseId);
  const [selectedPage, setPage] = useState(1);

  const deleteOverride = async (row: GetCourseOverridesRow) => {
    await API.course.deleteOverride(courseId, {
      email: row.email,
      role: row.role as Role,
    });
    toast.success("Successfully deleted the override for " + row.name);
    mutate();
  };

  const rows = data?.data ?? [];
  const pageCount = Math.ceil(rows.length / PAGE_SIZE);
  // If the list shrinks (e.g. after a delete), stay on its last page
  const page = Math.min(selectedPage, Math.max(pageCount, 1));
  const goTo = (p: number) => (e: React.MouseEvent) => {
    e.preventDefault();
    if (p >= 1 && p <= pageCount) setPage(p);
  };
  const dimmed = (off: boolean) =>
    off ? "pointer-events-none opacity-50" : "";

  return (
    <OverrideContents>
      <h1>Course Overrides</h1>
      <br />
      <AddOverrideInput courseId={courseId} onAddOverride={() => mutate()} />
      <Table data-cy="override-table">
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Email</TableHead>
            <TableHead>Role</TableHead>
            <TableHead>Delete</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.length === 0 && (
            <TableRow>
              <TableCell colSpan={4} className="text-center">
                No Data
              </TableCell>
            </TableRow>
          )}
          {rows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE).map((row) => (
            // Keyed by email so an open confirm stays with its row when the
            // list refreshes
            <TableRow key={row.email}>
              <TableCell>{row.name}</TableCell>
              <TableCell>{row.email}</TableCell>
              <TableCell>{formattedRoles[row.role]}</TableCell>
              <TableCell>
                <DeleteOverrideButton row={row} onDelete={deleteOverride} />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      {pageCount > 0 && (
        <Pagination className="my-4 justify-end">
          {/* Wraps onto more lines on narrow screens, still right-aligned */}
          <PaginationContent className="flex-wrap justify-end">
            <PaginationItem>
              <PaginationLink
                href="#"
                aria-label="Previous Page"
                aria-disabled={page === 1}
                tabIndex={page === 1 ? -1 : undefined}
                className={dimmed(page === 1)}
                onClick={goTo(page - 1)}
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
                aria-disabled={page === pageCount}
                tabIndex={page === pageCount ? -1 : undefined}
                className={dimmed(page === pageCount)}
                onClick={goTo(page + 1)}
              >
                <ChevronRight className="size-4" />
              </PaginationLink>
            </PaginationItem>
          </PaginationContent>
        </Pagination>
      )}
      <br />
      <div>
        Is Khoury Admin/Banner down? Toggle this to temporarily allow students
        to join your class.{" "}
        <Switch
          aria-label="Allow students to join your class"
          className="align-middle"
          checked={!!course?.selfEnroll}
          onCheckedChange={async (checked) => {
            // Flip right away, like the old switch, then sync with the server
            // Only with a loaded course: other screens share this cache entry
            // and would break on a partial { selfEnroll } object
            const previous = course;
            if (previous)
              mutateCourse({ ...previous, selfEnroll: checked }, false);
            try {
              await API.course.toggleSelfEnroll(courseId);
            } catch (e) {
              // Undo first, so the switch is right even if the refetch fails
              if (previous) mutateCourse(previous, false);
              toast.error(
                e.response?.data?.message ||
                  "Failed to update the self-enroll setting"
              );
            }
            mutateCourse();
          }}
        />
      </div>
      <br />
      <b>
        You must manually toggle this feature off later, or any student will be
        allowed to join your class.
      </b>
    </OverrideContents>
  );
}

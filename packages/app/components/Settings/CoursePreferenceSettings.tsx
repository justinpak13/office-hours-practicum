import useSWR from "swr";
import React, { ReactElement, useRef, useState } from "react";
import { API } from "@koh/api-client";
import { UserCourse } from "@koh/common";
import { ChevronLeft, ChevronRight, CircleAlert } from "lucide-react";
import Router from "next/router";
import { toast } from "sonner";
import { HeaderTitle } from "./Styled";
import { useCourse } from "../../hooks/useCourse";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
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

const PAGE_SIZE = 10;

// Outside the component so dialog and page state changes don't remount each row
function InstructorCell({ courseId }: { courseId: number }) {
  const course = useCourse(courseId);

  return <>{course.course?.coordinator_email}</>;
}

export default function CoursePreferenceSettings(): ReactElement {
  const { data: profile, mutate } = useSWR(`api/v1/profile`, async () =>
    API.profile.index()
  );
  // The course stays set after closing, so the text doesn't blank mid-animation
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirming, setConfirming] = useState<UserCourse | null>(null);
  // The dialog has no trigger of its own, so focus goes back here on close
  const openerRef = useRef<HTMLButtonElement | null>(null);
  // Matches the old table's pager: 10 rows a page
  const [selectedPage, setPage] = useState(1);

  const formattedRoles = {
    student: "Student",
    ta: "TA",
    professor: "Professor",
  };

  async function withdraw(course: UserCourse) {
    await API.course.withdrawCourse(course.course.id);
    toast.success("Successfully withdrew from " + course.course.name);
    await mutate();
    await Router.push("/");
  }

  const courses = profile?.courses ?? [];
  const pageCount = Math.ceil(courses.length / PAGE_SIZE);
  // If the list shrinks (e.g. after a withdraw), stay on its last page
  const page = Math.min(selectedPage, Math.max(pageCount, 1));
  const goTo = (p: number) => (e: React.MouseEvent) => {
    e.preventDefault();
    if (p >= 1 && p <= pageCount) setPage(p);
  };
  const dimmed = (off: boolean) =>
    off ? "pointer-events-none opacity-50" : "";

  return (
    profile && (
      <div>
        <HeaderTitle>
          <h1>Course Preferences</h1>
        </HeaderTitle>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Course name</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Instructor</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {courses.length === 0 && (
              <TableRow>
                <TableCell colSpan={4} className="text-center">
                  No data
                </TableCell>
              </TableRow>
            )}
            {courses
              .slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)
              .map((c) => (
                <TableRow key={c.course.id}>
                  <TableCell>{c.course.name}</TableCell>
                  <TableCell>{formattedRoles[c.role]}</TableCell>
                  <TableCell>
                    <InstructorCell courseId={c.course.id} />
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="destructive"
                      className="ml-5 rounded-full"
                      onClick={(e) => {
                        openerRef.current = e.currentTarget;
                        setConfirming(c);
                        setConfirmOpen(true);
                      }}
                    >
                      Withdraw
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
          </TableBody>
        </Table>
        {pageCount > 0 && (
          <Pagination className="my-4 justify-end">
            <PaginationContent>
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
              {Array.from({ length: pageCount }, (_, i) => i + 1).map((p) => (
                <PaginationItem key={p}>
                  <PaginationLink
                    href="#"
                    isActive={p === page}
                    onClick={goTo(p)}
                  >
                    {p}
                  </PaginationLink>
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
        <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
          <AlertDialogContent
            onCloseAutoFocus={(e) => {
              e.preventDefault();
              openerRef.current?.focus();
            }}
          >
            <AlertDialogHeader>
              <AlertDialogTitle className="flex items-center gap-2">
                <CircleAlert className="size-5 text-amber-500" />
                Please Confirm!
              </AlertDialogTitle>
              <AlertDialogDescription>
                {confirming &&
                  `Please confirm that you want to unenroll from ${
                    confirming.course.name
                  } as a ${
                    formattedRoles[confirming.role]
                  }.  The only way to get back is by contacting a professor!`}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={() => withdraw(confirming)}>
                OK
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    )
  );
}

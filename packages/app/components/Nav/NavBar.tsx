import { Role } from "@koh/common";
import { ChevronDown, Menu as MenuIcon } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/router";
import React, { ReactElement, useState } from "react";
import styled from "styled-components";
import { useCourse } from "../../hooks/useCourse";
import { useLocalStorage } from "../../hooks/useLocalStorage";
import { useProfile } from "../../hooks/useProfile";
import { useRoleInCourse } from "../../hooks/useRoleInCourse";
import AlertsContainer from "./AlertsContainer";
import NavBarTabs, { NavBarTabsItem } from "./NavBarTabs";
import ProfileDrawer from "./ProfileDrawer";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

const Nav = styled.nav`
  padding: 0px 0px;
  display: flex;
  align-items: center;
  height: 67px;
  z-index: 1;
`;

// A hack to get the white stripe edge to edge, even when Nav is narrower.
const NavBG = styled.nav`
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 67px;
  background: #fff;
  border-bottom: solid 1px #e8e8e8;
`;

const LogoContainer = styled.div`
  z-index: 1;
  display: flex;
  align-items: center;
  margin-right: 20px;
`;

const Logo = styled.div`
  font-size: 20px;
  font-weight: 500;
  color: #262626;
  text-transform: capitalize;
`;

const MenuCon = styled.div`
  flex-grow: 1;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding-left: 0px;
`;

const LeftMenu = styled.div`
  @media (max-width: 650px) {
    display: none;
  }
  flex-grow: 1;
`;

const RightMenu = styled.div`
  @media (max-width: 650px) {
    display: none;
  }
`;

interface NavBarProps {
  courseId: number;
}

export default function NavBar({ courseId }: NavBarProps): ReactElement {
  const profile = useProfile();
  if (!courseId) {
    courseId = profile?.courses[0]?.course?.id;
  }

  const [_defaultCourse, setDefaultCourse] = useLocalStorage(
    "defaultCourse",
    null
  );
  const [visible, setVisible] = useState<boolean>(false);
  const { pathname } = useRouter();
  const { course } = useCourse(courseId);
  const role = useRoleInCourse(courseId);

  const openQueues = course?.queues?.filter((queue) => queue.isOpen);

  const tabs: NavBarTabsItem[] = [
    {
      href: "/course/[cid]/today",
      as: `/course/${courseId}/today`,
      text: "Today",
    },
    {
      href: "/course/[cid]/schedule",
      as: `/course/${courseId}/schedule`,
      text: "Schedule",
    },
  ];

  if (role === Role.PROFESSOR) {
    tabs.push({
      href: "/course/[cid]/course_admin_panel",
      as: `/course/${courseId}/course_admin_panel`,
      text: "Admin Panel",
    });
  }

  if (openQueues?.length > 0) {
    tabs.push({
      text: "Queue",
      queues: openQueues,
      courseId: courseId,
    });
  }

  if (role === Role.PROFESSOR) {
    tabs.push({
      href: "/course/[cid]/insights",
      as: `/course/${courseId}/insights`,
      text: "Insights",
    });
  }

  return courseId ? (
    <>
      <NavBG />
      <AlertsContainer courseId={courseId} />
      <Nav>
        <LogoContainer>
          {profile?.courses.length > 1 ? (
            // Course picker (was antd Dropdown): click the course name
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button type="button" className="flex">
                  <Logo className="flex items-center">
                    <span>{course?.name}</span>
                    <ChevronDown className="ml-[5px] size-4" aria-hidden />
                  </Logo>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                {profile?.courses?.map((c) => (
                  <Link
                    key={c.course.id}
                    href="/course/[cid]/today"
                    as={`/course/${c.course.id}/today`}
                    passHref
                  >
                    <DropdownMenuItem
                      asChild
                      onSelect={() => setDefaultCourse(c.course)}
                    >
                      <a className="cursor-pointer text-foreground">
                        {c.course.name}
                      </a>
                    </DropdownMenuItem>
                  </Link>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <Logo>
              <span>{course?.name}</span>
            </Logo>
          )}
        </LogoContainer>
        <MenuCon>
          <LeftMenu>
            <NavBarTabs horizontal currentHref={pathname} tabs={tabs} />
          </LeftMenu>
          <RightMenu>
            <ProfileDrawer courseId={courseId} />
          </RightMenu>
        </MenuCon>
        {/* Phone menu button, 650px and narrower (was antd Button + 3 bars) */}
        <Button
          variant="outline"
          size="icon"
          aria-label="Open menu"
          className="mt-2 inline-flex h-8 w-[34px] border-primary bg-transparent text-primary min-[651px]:hidden"
          onClick={() => setVisible(true)}
        >
          <MenuIcon className="size-5" aria-hidden />
        </Button>
        {/* Phone menu (was antd Drawer): the tabs and the profile menu */}
        <Sheet open={visible} onOpenChange={setVisible}>
          <SheetContent
            side="right"
            className="w-[378px] max-w-full gap-0 p-0 sm:max-w-full"
          >
            <SheetHeader className="border-b px-6 py-4 text-left">
              <SheetTitle className="m-0 text-base font-medium">
                Course
              </SheetTitle>
            </SheetHeader>
            <div className="p-3">
              <NavBarTabs currentHref={pathname} tabs={tabs} />
              <ProfileDrawer courseId={courseId} />
            </div>
          </SheetContent>
        </Sheet>
      </Nav>
    </>
  ) : null;
}

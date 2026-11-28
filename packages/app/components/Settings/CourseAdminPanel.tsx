import { Bell, Book, Pencil } from "lucide-react";
import React, { ReactElement, useState } from "react";
import styled from "styled-components";
import { Button } from "@/components/ui/button";
import { useProfile } from "../../hooks/useProfile";
import CourseRosterPage from "./CourseRosterPage";
import { SettingsPanelAvatar } from "./SettingsSharedComponents";
import TACheckInCheckOutTimes from "./TACheckInCheckOutTimes";
import CourseInformation from "./CourseInformation";

export enum CourseAdminOptions {
  CHECK_IN = "CHECK_IN",
  INFO = "INFO",
  ROSTER = "ROSTER",
}

interface CourseAdminPageProps {
  defaultPage: CourseAdminOptions;
  courseId: number;
}

const VerticalDivider = styled.div`
  @media (min-width: 767px) {
    border-right: 1px solid #cfd6de;
    margin-right: 32px;
  }
`;

const menuItems = [
  {
    key: CourseAdminOptions.CHECK_IN,
    label: "TA Check In/Out Times",
    Icon: Pencil,
    dataCy: "admin-menu-check-in",
  },
  {
    key: CourseAdminOptions.ROSTER,
    label: "Course Roster",
    Icon: Bell,
    dataCy: "admin-menu-roster",
  },
  {
    key: CourseAdminOptions.INFO,
    label: "Course Information",
    Icon: Book,
    dataCy: "admin-menu-info",
  },
];

export default function CourseAdminPanel({
  defaultPage,
  courseId,
}: CourseAdminPageProps): ReactElement {
  const profile = useProfile();
  const [currentSettings, setCurrentSettings] = useState(
    defaultPage || CourseAdminOptions.CHECK_IN
  );

  return (
    <div className="flex flex-wrap">
      {/* antd Col span={4} = 4/24 of the row */}
      <div className="max-w-[16.6667%] flex-none basis-[16.6667%] text-center">
        <SettingsPanelAvatar avatarSize={20} />
        <p className="text-center">
          Welcome back
          <br />
          {profile?.firstName} {profile?.lastName}
        </p>
        <nav
          aria-label="Course admin"
          className="flex flex-col gap-1 bg-[#f8f9fb] pt-5"
        >
          {menuItems.map(({ key, label, Icon, dataCy }) => (
            <Button
              key={key}
              variant={currentSettings === key ? "secondary" : "ghost"}
              aria-current={currentSettings === key ? "page" : undefined}
              className="w-full min-w-0 justify-start"
              title={label}
              data-cy={dataCy}
              onClick={() => setCurrentSettings(key)}
            >
              {/* the label truncates in a narrow column, like antd Menu. Below
                  767px (where VerticalDivider turns off) the column is too thin
                  for even one letter, so show icon + "…" as antd did; the label
                  stays the accessible name */}
              <Icon className="shrink-0" />
              <span className="truncate max-[766.98px]:sr-only">{label}</span>
              <span aria-hidden="true" className="min-[767px]:hidden">
                …
              </span>
            </Button>
          ))}
        </nav>
      </div>
      <VerticalDivider />
      <div className="flex min-w-0 grow flex-col gap-10">
        {/* antd Col span={20}: in this column only its 20/24 max-width applies */}
        <div className="max-w-[83.3333%]">
          {currentSettings === CourseAdminOptions.INFO && (
            <CourseInformation courseId={courseId} />
          )}
          {currentSettings === CourseAdminOptions.CHECK_IN && (
            <TACheckInCheckOutTimes courseId={courseId} />
          )}
          {currentSettings === CourseAdminOptions.ROSTER && (
            <CourseRosterPage courseId={courseId} />
          )}
        </div>
      </div>
    </div>
  );
}

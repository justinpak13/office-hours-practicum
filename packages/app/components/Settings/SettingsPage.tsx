import { AppWindow, Bell, Book, Trash2, Upload, User } from "lucide-react";
import { API } from "@koh/api-client";
import { Role } from "@koh/common";
import { useWindowWidth } from "@react-hook/window-size";
import React, { ReactElement, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import styled from "styled-components";
import useSWR from "swr";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import NotificationsSettings from "./NotificationsSettings";
import ProfileSettings from "./ProfileSettings";
import TeamsSettings from "./TeamsSettings";
import CoursePreferenceSettings from "./CoursePreferenceSettings";
import { useIsMobile } from "../../hooks/useIsMobile";
import { SettingsPanelAvatar } from "./SettingsSharedComponents";
import { useRoleInCourse } from "../../hooks/useRoleInCourse";
import { useRouter } from "next/router";

export enum SettingsOptions {
  PROFILE = "PROFILE",
  NOTIFICATIONS = "NOTIFICATIONS",
  TEAMS_SETTINGS = "TEAMS_SETTINGS",
  PREFERENCES = "PREFERENCES",
}

interface SettingsPageProps {
  defaultPage: SettingsOptions;
}

export const VerticalDivider = styled.div`
  @media (min-width: 767px) {
    border-right: 1px solid #cfd6de;
    margin-right: 32px;
  }
`;

const profilePicButtonClass = "mt-[10px] w-[5vw] min-w-[180px]";
// Mobile panels styled like antd Collapse: arrow on the left, pointing
// right when closed and down when open
// [&>h3]:m-0: the trigger's h3 wrapper picks up antd's global heading margin
const panelItemClass = "border-[#d9d9d9] last:border-b-0 [&>h3]:m-0";
const panelTriggerClass =
  "flex-row-reverse justify-end gap-3 px-4 py-3 text-[14px] font-normal leading-[1.5715] text-[rgba(0,0,0,0.85)] hover:no-underline [&>svg]:size-3 [&>svg]:-rotate-90 [&>svg]:text-[rgba(0,0,0,0.85)] [&[data-state=open]>svg]:rotate-0";
const panelContentClass = "border-t border-[#d9d9d9] bg-white p-4";

export default function SettingsPage({
  defaultPage,
}: SettingsPageProps): ReactElement {
  const {
    data: profile,
    error,
    mutate,
  } = useSWR(`api/v1/profile`, async () => API.profile.index());
  const router = useRouter();
  const { cid } = router.query;
  const role = useRoleInCourse(Number(cid));
  const isTAOrProfessor = role === Role.TA || role === Role.PROFESSOR;

  const [currentSettings, setCurrentSettings] = useState(
    defaultPage || SettingsOptions.PROFILE
  );
  const [uploading, setUploading] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  // Mobile panels mount on first open and then stay mounted (hidden while
  // closed), like antd Collapse, so unsaved typing survives switching panels
  const [openPanel, setOpenPanel] = useState("");
  const [openedPanels, setOpenedPanels] = useState<string[]>([]);
  // forceMount alone would also show a closed panel, so hide it ourselves
  const keepMounted = (panel: string) =>
    openedPanels.includes(panel)
      ? { forceMount: true as const, hidden: openPanel !== panel }
      : {};
  const isMobile = useIsMobile();
  const windowWidth = useWindowWidth();
  // Start at 0 so the server and browser render the same HTML; the effect
  // below sets the real size once the page is running in the browser.
  const [avatarSize, setAvatarSize] = useState(0);

  useEffect(() => {
    const widthDivider = isMobile ? 6 : 10;
    setAvatarSize(windowWidth / widthDivider);
  });

  const beforeUpload = (file: File) => {
    const isJpgOrPng = file.type === "image/jpeg" || file.type === "image/png";
    if (!isJpgOrPng) {
      toast.error("You can only upload JPG or PNG images!");
    }

    const isLt5M = file.size / 1024 / 1024 < 5;
    if (!isLt5M) {
      toast.error("Images must be smaller than 5MB!");
    }

    return isJpgOrPng && isLt5M;
  };

  const uploadPicture = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ""; // so picking the same file again still fires
    if (!file || !beforeUpload(file)) {
      return;
    }
    const body = new FormData();
    body.append("file", file); // the server reads FileInterceptor('file')
    setUploading(true);
    let ok = false;
    let failure = "";
    try {
      const res = await fetch("/api/v1/profile/upload_picture", {
        method: "POST",
        body,
      });
      ok = res.ok;
      if (!ok) {
        failure = (await res.json()).message;
      }
    } catch (err) {
      // network error or a non-JSON reply: use the fallback message
    }
    setUploading(false);
    if (ok) {
      toast.success("Uploaded your new profile picture");
      mutate();
    } else {
      toast.error(failure || "Failed to upload your profile picture");
    }
  };

  useEffect(() => {
    if (error) {
      toast.error(error.message ?? String(error));
    }
  }, [error]);

  const AvatarSettings = () => (
    <div>
      {avatarSize ? (
        <div
          className="flex flex-wrap"
          style={{
            marginTop: avatarSize / 6,
            justifyContent: `${isMobile ? "left" : "center"}`,
          }}
        >
          {uploading ? (
            <Skeleton
              className="shrink-0 rounded-full"
              style={{
                width: avatarSize,
                height: avatarSize,
                marginTop: avatarSize / 6,
                marginBottom: avatarSize / 12,
                marginLeft: avatarSize / 6,
                marginRight: avatarSize / 6,
              }}
            />
          ) : (
            <SettingsPanelAvatar avatarSize={avatarSize} />
          )}
          <div>
            {profile && (
              <h2>
                {profile.firstName} {profile.lastName}
              </h2>
            )}
            <input
              ref={fileInput}
              type="file"
              className="hidden"
              onChange={uploadPicture}
            />
            <Button
              variant="outline"
              className={profilePicButtonClass}
              onClick={() => fileInput.current?.click()}
            >
              <Upload /> Upload a Picture
            </Button>
            {profile?.photoURL && (
              <Button
                variant="outline"
                className={profilePicButtonClass}
                onClick={async () => {
                  try {
                    await API.profile.deleteProfilePicture();
                    toast.success("Removed your profile picture");
                    mutate();
                  } catch (e) {
                    toast.error("Failed to remove your profile picture");
                  }
                }}
              >
                <Trash2 /> Remove my Picture
              </Button>
            )}
            {profile?.hasUnregisteredCourses &&
              profile?.courses?.some((c) => c.role === Role.PROFESSOR) && (
                <Button
                  variant="outline"
                  className="mt-[10px] w-full"
                  onClick={async () => {
                    await API.profile.resetRegistration();
                    router.push("/apply");
                  }}
                >
                  <Book /> Register More Courses
                </Button>
              )}
          </div>
        </div>
      ) : null}
    </div>
  );

  const menuItems = [
    { key: SettingsOptions.PROFILE, label: "Personal Information", Icon: User },
    ...(isTAOrProfessor
      ? [
          {
            key: SettingsOptions.TEAMS_SETTINGS,
            label: "Teams Settings",
            Icon: AppWindow,
          },
        ]
      : []),
    { key: SettingsOptions.NOTIFICATIONS, label: "Notifications", Icon: Bell },
    {
      key: SettingsOptions.PREFERENCES,
      label: "Course Preferences",
      Icon: Book,
    },
  ];

  // SettingsMenu and DesktopSettingsSubpage are called as functions, like
  // AvatarSettings(). Rendered as <SettingsMenu />, React saw a new component
  // type on every render and remounted the settings forms, wiping unsaved
  // typing whenever the profile refreshed (e.g. after a photo upload).
  const SettingsMenu = () => (
    <>
      {isMobile ? (
        <Accordion
          type="single"
          collapsible
          className="mt-[10px] rounded-[2px] border border-[#d9d9d9] bg-[#fafafa]"
          value={openPanel}
          onValueChange={(panel) => {
            setOpenPanel(panel);
            if (panel && !openedPanels.includes(panel)) {
              setOpenedPanels([...openedPanels, panel]);
            }
          }}
        >
          <AccordionItem value="profile" className={panelItemClass}>
            <AccordionTrigger className={panelTriggerClass}>
              Personal Information
            </AccordionTrigger>
            <AccordionContent
              className={panelContentClass}
              {...keepMounted("profile")}
            >
              <ProfileSettings />
            </AccordionContent>
          </AccordionItem>
          {isTAOrProfessor && (
            <AccordionItem value="teams_settings" className={panelItemClass}>
              <AccordionTrigger className={panelTriggerClass}>
                Teams Settings
              </AccordionTrigger>
              <AccordionContent
                className={panelContentClass}
                {...keepMounted("teams_settings")}
              >
                <TeamsSettings />
              </AccordionContent>
            </AccordionItem>
          )}
          <AccordionItem value="notifications" className={panelItemClass}>
            <AccordionTrigger className={panelTriggerClass}>
              Notifications
            </AccordionTrigger>
            <AccordionContent
              className={panelContentClass}
              {...keepMounted("notifications")}
            >
              <NotificationsSettings />
            </AccordionContent>
          </AccordionItem>
          <AccordionItem value="preferences" className={panelItemClass}>
            <AccordionTrigger className={panelTriggerClass}>
              Course Preferences
            </AccordionTrigger>
            <AccordionContent
              className={panelContentClass}
              {...keepMounted("preferences")}
            >
              <CoursePreferenceSettings />
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      ) : (
        <nav aria-label="Settings" className="mt-[10px] flex flex-col gap-1">
          {menuItems.map(({ key, label, Icon }) => (
            <Button
              key={key}
              variant={currentSettings === key ? "secondary" : "ghost"}
              aria-current={currentSettings === key ? "page" : undefined}
              className="w-full min-w-0 justify-start"
              title={label}
              onClick={() => setCurrentSettings(key)}
            >
              {/* the label truncates in a narrow sidebar, like antd Menu */}
              <Icon className="shrink-0" />
              <span className="truncate">{label}</span>
            </Button>
          ))}
        </nav>
      )}
    </>
  );

  const DesktopSettingsSubpage = () => (
    <div>
      {currentSettings === SettingsOptions.PROFILE && <ProfileSettings />}
      {currentSettings === SettingsOptions.NOTIFICATIONS && (
        <NotificationsSettings />
      )}
      {currentSettings === SettingsOptions.TEAMS_SETTINGS && <TeamsSettings />}
      {currentSettings === SettingsOptions.PREFERENCES && (
        <CoursePreferenceSettings />
      )}
    </div>
  );

  return (
    <div>
      {isMobile ? (
        <div>
          {AvatarSettings()}
          {SettingsMenu()}
        </div>
      ) : (
        <div className="flex flex-wrap">
          {/* antd Col span={5} = 5/24 of the row */}
          <div className="max-w-[20.8333%] flex-none basis-[20.8333%] text-center">
            {AvatarSettings()}
            {SettingsMenu()}
          </div>
          <VerticalDivider />
          <div className="flex grow flex-col gap-10">
            {DesktopSettingsSubpage()}
          </div>
        </div>
      )}
    </div>
  );
}

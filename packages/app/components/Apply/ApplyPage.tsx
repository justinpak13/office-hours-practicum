import { KhouryProfCourse } from "@koh/common";
import React, { ReactElement, useState } from "react";
import ConfirmCourses from "./ConfirmCourses";
import EditCourse, { EditCourseInfo } from "./EditCourse";
import SelectCourses from "./SelectCourses";
import styled from "styled-components";
import { API } from "@koh/api-client";
import useSWR from "swr";
import Router from "next/router";
import { toast } from "sonner";
import { CircleCheck } from "lucide-react";
import { Progress } from "@/components/ui/progress";

export interface RegisterCourseInfo {
  name: string;
  crns: number[];
  displayName?: string;
  iCalURL?: string;
  coordinator_email?: string;
  timezone?: string;
}

// antd's Progress clamped the value to 0-100 (0/0 before any course is
// chosen gives NaN, and choosing none gives Infinity), so keep doing that
function clampPercent(n: number): number {
  if (!Number.isFinite(n)) return n > 0 ? 100 : 0;
  return Math.min(100, Math.max(0, n));
}

function ProgressBar({ percent }: { percent: number }): ReactElement {
  const value = clampPercent(percent);
  return (
    <div className="flex items-center gap-2 pb-[2.5em]">
      <Progress
        value={value}
        aria-label="Application progress"
        className="h-3 flex-1 border border-[#d9d9d9] bg-white [&>div]:rounded-full [&>div]:bg-[#408FEA]"
      />
      {/* Like antd: a green check at 100%, but text for the Infinity case */}
      {Number.isFinite(percent) && percent >= 100 ? (
        <span className="flex w-10 shrink-0">
          <CircleCheck
            aria-label="Done"
            className="size-[14px] fill-[#52c41a] text-white"
          />
        </span>
      ) : (
        <span className="w-10 shrink-0 text-sm text-black/85">{value}%</span>
      )}
    </div>
  );
}

export function createSGString({
  name,
  crns,
}: {
  name: string;
  crns: number[];
}): string {
  return `${name} (CRNs: ${crns.join(", ")})`;
}

export const Highlight = styled.span`
  color: #1890ff;
`;

export default function ApplyPage(): ReactElement {
  const [postBody, setPostBody] = useState<RegisterCourseInfo[]>([]);
  const [currentCourse, setCurrentCourse] = useState<number>(-1);
  const { data: profile, mutate: mutateProfile } = useSWR(
    `api/v1/profile`,
    async () => API.profile.index()
  );

  const handleSelectCourses = (selectedCourses: KhouryProfCourse[]) => {
    setPostBody(
      selectedCourses.map((course) => ({
        name: course.name,
        crns: course.crns,
      }))
    );
    setCurrentCourse(currentCourse + 1);
  };

  const handleEditCourse = (courseInfo: EditCourseInfo) => {
    const newPostBody = [...postBody];
    newPostBody[currentCourse] = {
      ...postBody[currentCourse],
      ...courseInfo,
    };
    setPostBody(newPostBody);
    setCurrentCourse(currentCourse + 1);
  };

  const handleSubmitCourses = async () => {
    try {
      await API.course.registerCourses(
        postBody.map((courseInfo) => ({
          name: courseInfo.displayName,
          sectionGroupName: courseInfo.name,
          iCalURL: courseInfo.iCalURL,
          coordinator_email: courseInfo.coordinator_email,
          timezone: courseInfo.timezone,
        }))
      );
      toast.success(
        "Successfully registered courses. Redirecting you to the app..."
      );
      await mutateProfile();
      Router.push(
        "/course/[cid]/today",
        `/course/${profile.courses[0].course.id}/today`
      );
    } catch (e) {
      toast.error(e.response?.data?.message);
    }
  };

  const calculateProgress = () => {
    return Math.round(((currentCourse + 1) * 100) / postBody.length);
  };

  return (
    <div style={{ padding: "3% 12%" }}>
      <h1>Apply for Khoury Office Hours</h1>
      <ProgressBar percent={calculateProgress()} />
      {currentCourse < 0 ? (
        <SelectCourses
          onSubmit={handleSelectCourses}
          initialValues={postBody.map((c) => c.name)}
        />
      ) : currentCourse < postBody.length ? (
        <EditCourse
          courseInfo={postBody[currentCourse]}
          onSubmitCourse={handleEditCourse}
          onBack={() => setCurrentCourse(currentCourse - 1)}
        />
      ) : (
        <ConfirmCourses
          courses={postBody}
          onSubmit={handleSubmitCourses}
          onBack={() => setCurrentCourse(currentCourse - 1)}
        />
      )}
    </div>
  );
}

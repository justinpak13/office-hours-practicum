import { API } from "@koh/api-client";
import { Heatmap, QueuePartial, Role } from "@koh/common";
import { chunk, mean } from "lodash";
import moment from "moment";
import Head from "next/head";
import { useRouter } from "next/router";
import dynamic from "next/dynamic";
import React, { ReactElement } from "react";
import styled from "styled-components";
import { StandardPageContainer } from "../../../components/common/PageContainer";
import NavBar from "../../../components/Nav/NavBar";
const SchedulePanel = dynamic(
  () => import("../../../components/Schedule/SchedulePanel"),
  { ssr: false }
);
import QueueCard, {
  QueueCardSkeleton,
} from "../../../components/Today/QueueCard";
import TodayPageCheckinButton from "../../../components/Today/QueueCheckInButton";
import WelcomeStudents from "../../../components/Today/WelcomeStudents";
import { useCourse } from "../../../hooks/useCourse";
import { useRoleInCourse } from "../../../hooks/useRoleInCourse";
import PopularTimes from "../../../components/Today/PopularTimes/PopularTimes";
import { orderBy } from "lodash";

const Container = styled.div`
  margin-top: 32px;
`;

const Title = styled.div`
  font-weight: 500;
  font-size: 30px;
  color: #212934;
`;

const RoleColorSpan = styled.span`
  color: #3684c6;
  font-weight: bold;
`;

function roleToString(role: Role) {
  switch (role) {
    case Role.TA:
      return "TA";
    case Role.STUDENT:
      return "Student";
    case Role.PROFESSOR:
      return "Professor";
    default:
      return "";
  }
}

function arrayRotate(arr, count) {
  const adjustedCount = (arr.length + count) % arr.length;
  return arr
    .slice(adjustedCount, arr.length)
    .concat(arr.slice(0, adjustedCount));
}

const collapseHeatmap = (heatmap: Heatmap): Heatmap =>
  chunk(heatmap, 4).map((hours) => {
    const filteredOfficeHours = hours.filter((v) => v !== -1);
    return filteredOfficeHours.length > 0 ? mean(filteredOfficeHours) : -1;
  });

export default function Today(): ReactElement {
  const router = useRouter();
  const { cid } = router.query;
  const role = useRoleInCourse(Number(cid));
  const { course, mutateCourse } = useCourse(Number(cid));

  const sortByProfOrder = role == Role.PROFESSOR ? "desc" : "asc";
  const sortedQueues =
    course?.queues &&
    orderBy(
      course?.queues,
      ["isOpen", "isProfessorQueue"],
      ["desc", sortByProfOrder]
    );

  const updateQueueNotes = async (
    queue: QueuePartial,
    notes: string
  ): Promise<void> => {
    const newQueues =
      course &&
      course.queues.map((q) => (q.id === queue.id ? { ...q, notes } : q));

    mutateCourse({ ...course, queues: newQueues }, false);
    await API.queues.update(queue.id, {
      notes,
      allowQuestions: queue.allowQuestions,
    });
    mutateCourse();
  };

  return (
    <StandardPageContainer>
      <Head>
        <title>{course?.name} | Khoury Office Hours</title>
      </Head>
      <WelcomeStudents />
      <NavBar courseId={Number(cid)} />
      <Container>
        {/* antd Row gutter={64}: -32px row margins, 32px column padding */}
        <div className="-mx-8 flex min-w-0 flex-wrap">
          {/* Col md={12} xs={24}: full width on phones, half from 768px */}
          <div className="relative mb-[15px] min-h-px max-w-full flex-[0_0_100%] px-8 md:max-w-[50%] md:flex-[0_0_50%]">
            <div className="flex min-w-0 flex-wrap justify-between">
              <Title>Current Office Hours</Title>
              <TodayPageCheckinButton />
            </div>
            <div className="flex min-w-0 flex-wrap">
              <div>
                <i>
                  You are a <RoleColorSpan>{roleToString(role)}</RoleColorSpan>{" "}
                  for this course
                </i>
              </div>
            </div>
            {course?.queues?.length === 0 ? (
              <h1 style={{ paddingTop: "100px" }}>
                There are no queues for this course
              </h1>
            ) : (
              sortedQueues?.map((q) => (
                <QueueCard
                  key={q.id}
                  queue={q}
                  isTA={role === Role.TA || role === Role.PROFESSOR}
                  updateQueueNotes={updateQueueNotes}
                />
              ))
            )}
            {!course && <QueueCardSkeleton />}
            {
              // This only works with UTC offsets in the form N:00, to help with other offsets, the size of the array might have to change to a size of 24*7*4 (for every 15 min interval)
              course && course.heatmap && (
                <PopularTimes
                  heatmap={collapseHeatmap(
                    arrayRotate(
                      course.heatmap,
                      -Math.floor(moment().utcOffset() / 15)
                    )
                  )}
                />
              )
            }
          </div>
          {/* Col md={12} sm={24}: full width from 576px, half from 768px */}
          <div className="relative mb-[15px] min-h-px max-w-full px-8 min-[576px]:flex-[0_0_100%] md:max-w-[50%] md:flex-[0_0_50%]">
            <SchedulePanel courseId={Number(cid)} defaultView="timeGridDay" />
          </div>
        </div>
      </Container>
    </StandardPageContainer>
  );
}

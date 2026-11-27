import { API } from "@koh/api-client";
import { QueuePartial, Role } from "@koh/common";
import { useRouter } from "next/router";
import React, { ReactElement, useState } from "react";
import { toast } from "sonner";
import styled from "styled-components";
import { useCourse } from "../../hooks/useCourse";
import { useProfile } from "../../hooks/useProfile";
import { useRoleInCourse } from "../../hooks/useRoleInCourse";
import QueueCheckInModal from "./QueueCheckInModal";
import QueueCreateModal, { QueueCreateValues } from "./QueueCreateModal";
import { queueButtonBase } from "../Queue/queueButtonStyles";
import TACheckinButton, { CheckinButton } from "./TACheckinButton";

// antd's default-size button, without antd (same styles as the queue buttons)
const CreateQueueButton = styled.button.attrs({ type: "button" })`
  ${queueButtonBase}
  height: 32px;
  padding: 4px 15px;
  font-size: 14px;
  border-radius: 2px;
  color: white;
  background: #2a9187;
  &:hover,
  &:focus {
    color: white;
    background: #39aca1;
  }
`;

export default function TodayPageCheckinButton(): ReactElement {
  // state for check in modal
  const [checkInModalVisible, setCheckInModalVisible] = useState(false);
  const [createQueueModalVisible, setCreateQueueModalVisible] = useState(false);

  const profile = useProfile();
  const router = useRouter();
  const { cid } = router.query;
  const { course, mutateCourse } = useCourse(Number(cid));
  const role = useRoleInCourse(Number(cid));
  // undefined until the profile loads, so check for staff rather than
  // "not a student"
  const isStaff = role === Role.TA || role === Role.PROFESSOR;
  const availableQueues = course?.queues.filter((q) =>
    role === Role.TA ? !q.isProfessorQueue : true
  );
  const queueCheckedIn = course?.queues.find((queue) =>
    queue.staffList.find((staff) => staff.id === profile?.id)
  );

  const numQueues = course?.queues.length;

  const renderProperModal = () => {
    // Until the course loads, numQueues is undefined and there are no queues
    // to list, so the check-in modal would crash
    if (!course) return;
    numQueues !== 0
      ? setCheckInModalVisible(true)
      : setCreateQueueModalVisible(true);
  };

  // Only called with valid values: the form shows its own errors
  const submitMakeQueue = async (queueRequest: QueueCreateValues) => {
    try {
      await API.taStatus.makeQueue(
        Number(cid),
        queueRequest.officeHourName,
        !queueRequest.allowTA,
        queueRequest.notes
      );
      toast.success(
        `Created a new queue ${queueRequest.officeHourName}. Checking you in...`
      );
      const redirectID = await API.taStatus.checkIn(
        Number(cid),
        queueRequest.officeHourName
      );
      mutateCourse();
      router.push(
        "/course/[cid]/queue/[qid]",
        `/course/${Number(cid)}/queue/${redirectID.id}`
      );
      setCreateQueueModalVisible(false);
    } catch (err) {
      toast.error(err.response?.data?.message);
    }
  };

  const onCreateQueueButtonClick = () => {
    setCheckInModalVisible(false);
    setCreateQueueModalVisible(true);
  };

  return (
    <>
      {checkInModalVisible && (
        <QueueCheckInModal
          visible={checkInModalVisible}
          onSubmit={async (queueId: number) => {
            let redirectID: QueuePartial;
            try {
              redirectID = await API.taStatus.checkIn(
                Number(cid),
                availableQueues[queueId].room
              );
              mutateCourse();
              router.push(
                "/course/[cid]/queue/[qid]",
                `/course/${Number(cid)}/queue/${redirectID.id}`
              );
            } catch (err) {
              toast.error(err.response?.data?.message);
            }
          }}
          onCancel={() => setCheckInModalVisible(false)}
          button={
            <CreateQueueButton onClick={onCreateQueueButtonClick}>
              + Create Queue
            </CreateQueueButton>
          }
          queues={availableQueues}
        />
      )}
      {createQueueModalVisible && (
        <QueueCreateModal
          visible={createQueueModalVisible}
          onSubmit={submitMakeQueue}
          onCancel={() => setCreateQueueModalVisible(false)}
          role={role}
          lastName={profile?.lastName}
        />
      )}
      {!queueCheckedIn && isStaff && (
        <CheckinButton
          type="default"
          size="large"
          data-cy="check-in-modal-button"
          disabled={!course}
          onClick={() => renderProperModal()}
        >
          Check In
        </CheckinButton>
      )}
      {queueCheckedIn && isStaff && (
        <TACheckinButton
          courseId={Number(cid)}
          room={queueCheckedIn.room}
          state="CheckedIn"
        />
      )}
    </>
  );
}

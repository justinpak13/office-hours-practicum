import { API } from "@koh/api-client";
import { useRouter } from "next/router";
import React, { ReactElement } from "react";
import { toast } from "sonner";
import styled from "styled-components";
import { useCourse } from "../../hooks/useCourse";
import { queueButtonBase } from "../Queue/queueButtonStyles";

type LargeButtonProps = Omit<
  React.ButtonHTMLAttributes<HTMLButtonElement>,
  "type"
> & {
  /** antd's button type; these are always default buttons */
  type?: string;
  /** antd's size; these are always large */
  size?: string;
  /** full width, like antd's block */
  block?: boolean;
  "data-cy"?: string;
};

// antd's large button (size="large", optionally block), without antd. Same
// styles as the queue buttons, so the Today and TA queue pages look unchanged.
const LargeButtonBase = styled.button<{ $block?: boolean }>`
  ${queueButtonBase}
  height: 40px;
  padding: 6.4px 15px;
  font-size: 16px;
  border-radius: 2px;
  ${({ $block }) => $block && "display: block; width: 100%;"}
`;

const LargeButton = React.forwardRef<HTMLButtonElement, LargeButtonProps>(
  function LargeButton(
    // type and size are antd's; these buttons are always default and large
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    { type, size, block, children, ...props }: LargeButtonProps,
    ref: React.ForwardedRef<HTMLButtonElement>
  ) {
    return (
      <LargeButtonBase ref={ref} type="button" $block={block} {...props}>
        <span>{children}</span>
      </LargeButtonBase>
    );
  }
);

export const CheckinButton = styled(LargeButton)`
  background: #1890ff;
  border-radius: 6px;
  color: white;
  font-weight: 500;
  font-size: 14px;
`;

export const CheckOutButton = styled(LargeButton)`
  color: #da3236;
  font-weight: 500;
  font-size: 14px;
  border-radius: 6px;
`;

type CheckInButtonState =
  | "CheckedIn"
  | "CheckedOut"
  | "CheckedIntoOtherQueueAlready";

interface TACheckinButtonProps {
  courseId: number;
  room: string; // name of room to check into
  state: CheckInButtonState; // State of the button
  disabled?: boolean;
  block?: boolean;
}
export default function TACheckinButton({
  courseId,
  room,
  state,
  disabled = false,
  block = false,
}: TACheckinButtonProps): ReactElement {
  const router = useRouter();

  const { course, mutateCourse } = useCourse(courseId);

  async function checkInTA() {
    // to see old check in in person functionality look at commit b4768bbfb0f36444c80961703bdbba01ff4a5596
    //trying to limit changes to the frontend, all queues will have the room online

    try {
      const redirectID = await API.taStatus.checkIn(courseId, room);
      mutateCourse();
      router.push(
        "/course/[cid]/queue/[qid]",
        `/course/${courseId}/queue/${redirectID.id}`
      );
    } catch (err) {
      toast.error(err.response?.data?.message);
    }
  }

  return (
    <>
      {state === "CheckedIn" && (
        <CheckOutButton
          type="default"
          size="large"
          disabled={disabled}
          block={block}
          data-cy="check-out-button"
          onClick={async () => {
            await API.taStatus.checkOut(courseId, room);
            mutateCourse();
            toast.success("Checked out successfully");
          }}
        >
          Check Out
        </CheckOutButton>
      )}
      {state === "CheckedOut" && (
        <CheckinButton
          type="default"
          size="large"
          block={block}
          onClick={() => checkInTA()}
          disabled={disabled || !course}
          data-cy="check-in-button"
        >
          Check In
        </CheckinButton>
      )}
    </>
  );
}

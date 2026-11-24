import { Ban, CircleAlert, Frown, Megaphone, RefreshCw } from "lucide-react";
import Linkify from "react-linkify";
import moment from "moment";
import React, { ReactElement, ReactNode, useState } from "react";
import styled from "styled-components";
import { useQueue } from "../../hooks/useQueue";
import { RenderEvery } from "../RenderEvery";
import { TAStatuses } from "./TAStatuses";
import { API } from "@koh/api-client";
import Router, { useRouter } from "next/router";
import { toast } from "sonner";
import { useCourse } from "../../hooks/useCourse";
import { antdButtonBase, antdButtonPrimary } from "./antdButtonCss";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export const Container = styled.div`
  display: flex;
  flex-direction: row;
  align-items: center;
`;

const QueueTitle = styled.div`
  font-weight: 500;
  font-size: 24px;
  color: #212934;
`;

export const NotesText = styled.div`
  font-size: 16px;
  color: #5f6b79;
`;

// New queue styled components start here
const InfoColumnContainer = styled.div`
  flex-shrink: 0;
  padding-bottom: 30px;
  position: relative;
  display: flex;
  flex-direction: column;
  @media (min-width: 650px) {
    margin-top: 32px;
    width: 290px;
  }
`;

// antd's large block button (size="large" block), without antd
const QueueInfoColumnButtonStyle = styled.button<{ $primary?: boolean }>`
  ${antdButtonBase}
  ${({ $primary }) => $primary && antdButtonPrimary}
  display: block;
  width: 100%;
  height: 40px;
  padding: 6.4px 15px;
  font-weight: 500;
  font-size: 14px;
  border: 1px solid #cfd6de;
  border-radius: 6px;
  margin-bottom: 12px;
`;

type QueueInfoColumnButtonProps = Omit<
  React.ButtonHTMLAttributes<HTMLButtonElement>,
  "type"
> & {
  /** antd's button type: "primary" is the filled blue button */
  type?: "primary" | "default";
  "data-cy"?: string;
};

export const QueueInfoColumnButton = React.forwardRef<
  HTMLButtonElement,
  QueueInfoColumnButtonProps
>(function QueueInfoColumnButton(
  { type, children, ...props }: QueueInfoColumnButtonProps,
  ref: React.ForwardedRef<HTMLButtonElement>
) {
  return (
    <QueueInfoColumnButtonStyle
      ref={ref}
      type="button"
      $primary={type === "primary"}
      {...props}
    >
      <span>{children}</span>
    </QueueInfoColumnButtonStyle>
  );
});

// antd's blue Tag
const ProfessorQueueTag = styled.span`
  display: inline-block;
  height: auto;
  margin-right: 8px;
  padding: 0 7px;
  font-size: 12px;
  line-height: 20px;
  white-space: nowrap;
  color: #096dd9;
  background: #e6f7ff;
  border: 1px solid #91d5ff;
  border-radius: 2px;
`;

const QueuePropertyRow = styled.div`
  display: flex;
  flex-direction: row;
  align-items: center; // This kinda funky, not sure how to align the tops of the row
  margin-bottom: 20px;
  color: #5f6b79;
  font-size: 20px;
`;

const QueuePropertyText = styled.div`
  margin-left: 12px;
  font-size: 16px;

  // To break text in flexbox
  min-width: 0;
  overflow-wrap: break-word;

  // to show new lines in the text
  white-space: pre-wrap;
`;

const StaffH2 = styled.h2`
  margin-top: 32px;
`;

const QueueRoomGroup = styled.div`
  display: flex;
  flex-direction: row;
  align-items: center;
`;

const QueueInfo = styled.div`
  margin-bottom: 24px;
`;

const QueueText = styled.div`
  max-height: 200px;
  overflow-y: auto;
  width: 100%;
`;

const DisableQueueButton = styled(QueueInfoColumnButton)`
  color: white;
  background: #da3236;
  &:hover,
  &:focus {
    color: #da3236;
    background: #fff;
    border-color: #da3236;
  }
`;

const ClearQueueButton = styled(QueueInfoColumnButton)`
  color: #d4380d;
  background: #fff;
  border-color: #d4380d;
  &:hover,
  &:focus {
    background: #fff;
    color: #da3236;
    border-color: #da3236;
  }
`;

const QueueManagementBox = styled.div`
  display: flex;
  flex-direction: column;
  justify-content: flex-end;
  color: white;
  width: 100%;
  height: 100%;
  bottom: 0;
`;

interface QueueInfoColumnProps {
  queueId: number;
  isStaff: boolean;
  buttons: ReactNode;
}

export function QueueInfoColumn({
  queueId,
  isStaff,
  buttons,
}: QueueInfoColumnProps): ReactElement {
  const { queue, mutateQueue } = useQueue(queueId);
  const router = useRouter();
  const { mutateCourse } = useCourse(Number(router.query.cid));

  const disableQueue = async () => {
    await API.queues.disable(queueId);
    // Refresh the course too: the today page we go to next reads the queue
    // list from it, and SWR would otherwise reuse a copy fetched moments ago
    // that still lists this queue
    await Promise.all([mutateQueue(), mutateCourse()]);
    toast.success("Successfully disabled queue: " + queue.room);
    await Router.push("/");
  };

  const clearQueue = async () => {
    await API.queues.clean(queueId);
    await mutateQueue();
    toast.success("Successfully cleaned queue: " + queue.room);
  };

  return (
    <InfoColumnContainer>
      <QueueInfo>
        <QueueRoomGroup>
          <QueueTitle data-cy="room-title">
            {queue?.room} {queue?.isDisabled && <b>(disabled)</b>}
          </QueueTitle>
          {!queue.allowQuestions && (
            <Tooltip>
              <TooltipTrigger asChild>
                <span
                  data-cy="stopQuestions"
                  tabIndex={0}
                  aria-label="This queue is no longer accepting questions"
                  className="ml-2 inline-flex text-[red]"
                >
                  <Ban className="size-6" />
                </span>
              </TooltipTrigger>
              <TooltipContent>
                This queue is no longer accepting questions
              </TooltipContent>
            </Tooltip>
          )}
        </QueueRoomGroup>

        {queue?.isProfessorQueue && (
          <QueuePropertyRow>
            <ProfessorQueueTag>Professor Queue</ProfessorQueueTag>
          </QueuePropertyRow>
        )}
      </QueueInfo>
      {queue?.notes && (
        <QueuePropertyRow>
          <Megaphone className="size-5 shrink-0" />
          <QueueText>
            <Linkify
              componentDecorator={(decoratedHref, decoratedText, key) => (
                <a
                  target="_blank"
                  rel="noopener noreferrer"
                  href={decoratedHref}
                  key={key}
                >
                  {decoratedText}
                </a>
              )}
            >
              <QueuePropertyText>{queue.notes}</QueuePropertyText>
            </Linkify>
          </QueueText>
        </QueuePropertyRow>
      )}
      <QueueUpToDateInfo queueId={queueId} />
      {buttons}
      <StaffH2>Staff</StaffH2>
      <TAStatuses queueId={queueId} />
      {isStaff && (
        <QueueManagementBox>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <ClearQueueButton data-cy="clear-queue-button">
                Clear Queue
              </ClearQueueButton>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle className="text-sm font-normal">
                  Are you sure you want to clear all students from the queue?
                </AlertDialogTitle>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>No</AlertDialogCancel>
                <AlertDialogAction
                  data-cy="clear-queue-confirm"
                  onClick={clearQueue}
                >
                  Yes
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <DisableQueueButton
                data-cy="queue-disable-button"
                disabled={queue?.isDisabled}
              >
                {queue?.isDisabled ? `Queue deleted` : `Delete Queue`}
              </DisableQueueButton>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle className="flex items-center gap-2">
                  <CircleAlert className="size-5 shrink-0 text-[#faad14]" />
                  Please Confirm!
                </AlertDialogTitle>
                <AlertDialogDescription className="whitespace-pre-wrap text-foreground">
                  {`Please confirm that you want to disable the queue: ${queue?.room}.\n
      This queue will no longer appear in the app, and any students currently in the queue will be removed.`}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  data-cy="disable-queue-confirm"
                  onClick={() => disableQueue()}
                >
                  OK
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </QueueManagementBox>
      )}
    </InfoColumnContainer>
  );
}

function QueueUpToDateInfo({ queueId }: { queueId: number }): ReactElement {
  const [lastUpdated, setLastUpdated] = useState(null);
  const { isLive } = useQueue(queueId, setLastUpdated);
  return (
    <QueuePropertyRow className="hide-in-percy">
      {isLive || lastUpdated ? (
        <RefreshCw className="size-5 shrink-0" />
      ) : (
        <Frown className="size-5 shrink-0" />
      )}
      <QueuePropertyText className="hide-in-percy">
        {isLive ? (
          "Queue up to date"
        ) : lastUpdated ? (
          <RenderEvery
            render={() => {
              const secondsAgo = (Date.now() - lastUpdated.getTime()) / 1000;
              return `Queue updated ${
                secondsAgo < 60
                  ? Math.ceil(secondsAgo) + "s"
                  : moment(lastUpdated).fromNow(true)
              } ago`;
            }}
            interval={1000}
          />
        ) : (
          "Queue may be out of date"
        )}
      </QueuePropertyText>
    </QueuePropertyRow>
  );
}

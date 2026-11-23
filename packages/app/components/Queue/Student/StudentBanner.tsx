import { API } from "@koh/api-client";
import { OpenQuestionStatus, Question } from "@koh/common";
import { Check, ListX, Pencil, Undo2, Users, X } from "lucide-react";
import React, { ReactElement, ReactNode } from "react";
import styled from "styled-components";
import { useQueue } from "../../../hooks/useQueue";
import { useStudentQuestion } from "../../../hooks/useStudentQuestion";
import { toOrdinal } from "../../../utils/ordinal";
import Banner, { BannerButton, BannerDangerButton } from "../Banner";
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
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

const BoldNumber = styled.span`
  font-weight: bold;
`;

const QuestionDetails = styled.div`
  display: flex;
`;
const InfoHeader = styled.div`
  font-weight: bold;
  font-size: 14px;
  font-variant: small-caps;
`;

const Bullets = styled.ul`
  color: #000;
`;

const ColWithRightMargin = styled.div`
  margin-right: 32px;
`;

const PriorityQueuedBanner = styled.span`
  display: flex;
  flex-direction: column;
  margin: 12px 0;
`;

// Icons sized like the old antd icons in a large circle button (18px)
const icon = (Icon: typeof Pencil) => (
  <Icon className="inline-block size-[18px] align-[-0.125em]" />
);

function WithTooltip({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent>{title}</TooltipContent>
    </Tooltip>
  );
}

interface StudentBannerProps {
  queueId: number;
  editQuestion: () => void;
  leaveQueue: () => void;
}
export default function StudentBanner({
  queueId,
  editQuestion,
  leaveQueue,
}: StudentBannerProps): ReactElement {
  const { studentQuestion, studentQuestionIndex } = useStudentQuestion(queueId);
  const isQueueOnline = useQueue(queueId).queue?.room.startsWith("Online");

  switch (studentQuestion?.status) {
    case "Drafting":
      return (
        <Banner
          titleColor="#faad14"
          contentColor="#ffd666"
          title="Please finish writing your question"
          content="Your spot in queue has been temporarily reserved. Please finish describing your question to receive help and finish joining the queue."
          buttons={
            <>
              <WithTooltip title="Delete Draft">
                <BannerButton icon={icon(ListX)} onClick={leaveQueue} />
              </WithTooltip>
              <WithTooltip title="Finish Draft">
                <BannerButton
                  data-cy="edit-question"
                  icon={icon(Pencil)}
                  onClick={async () => {
                    editQuestion();
                  }}
                />
              </WithTooltip>
            </>
          }
        />
      );
    case "Queued":
      return (
        <Banner
          titleColor="#3684C6"
          contentColor="#ABD4F3"
          title={
            <span>
              You are{" "}
              <BoldNumber>{toOrdinal(studentQuestionIndex + 1)}</BoldNumber> in
              queue
            </span>
          }
          buttons={
            <>
              <LeaveQueueButton leaveQueue={leaveQueue} />
              <WithTooltip title="Edit Question">
                <BannerButton
                  data-cy="edit-question"
                  icon={icon(Pencil)}
                  onClick={editQuestion}
                />
              </WithTooltip>
            </>
          }
          content={<QuestionDetailRow studentQuestion={studentQuestion} />}
        />
      );
    case "Helping":
      return (
        <Banner
          titleColor="#66BB6A"
          contentColor="#82C985"
          title={
            <span>
              <BoldNumber>{studentQuestion.taHelped.name}</BoldNumber> is coming
              to help you
            </span>
          }
          buttons={
            <>
              <LeaveQueueButton leaveQueue={leaveQueue} />
              {isQueueOnline && (
                <WithTooltip title="Open Teams DM">
                  <BannerButton
                    icon={icon(Users)}
                    onClick={() => {
                      window.open(
                        `https://teams.microsoft.com/l/chat/0/0?users=${studentQuestion.taHelped.email}`
                      );
                    }}
                  />
                </WithTooltip>
              )}
            </>
          }
          content={
            <Bullets>
              <li>Please be dressed appropriately</li>
              <li>Be respectful of the TA’s time</li>
              <li>Come prepared with your question!</li>
            </Bullets>
          }
        />
      );
    case "ReQueueing":
      return (
        <Banner
          titleColor="#66BB6A"
          contentColor="#82C985"
          title={<span>Are you ready to re-join the queue?</span>}
          buttons={
            <>
              <LeaveQueueButton leaveQueue={leaveQueue} />
              <WithTooltip title="Rejoin Queue">
                <Button
                  size="icon"
                  className="ml-4 size-10 rounded-full border-0"
                  onClick={async () => {
                    await API.questions.update(studentQuestion.id, {
                      status: OpenQuestionStatus.PriorityQueued,
                    });
                  }}
                  data-cy="re-join-queue"
                  aria-label="Rejoin Queue"
                >
                  <Undo2 className="!size-[18px]" />
                </Button>
              </WithTooltip>
            </>
          }
          content={
            <Bullets>
              <li>Have you finished doing what the TA has told you?</li>
              <li>
                Once you hit requeue, you will be placed at the top of the queue
              </li>
            </Bullets>
          }
        />
      );
    case "PriorityQueued":
      return (
        <Banner
          titleColor="#3684C6"
          contentColor="#ABD4F3"
          title={
            <PriorityQueuedBanner>
              You are now in a priority queue, you will be helped soon. <br />
              <span style={{ fontSize: 16 }}>
                You were last helped by{" "}
                <span style={{ fontWeight: "bold" }}>
                  {studentQuestion.taHelped.name}
                </span>
                .
              </span>
            </PriorityQueuedBanner>
          }
          buttons={
            <>
              <LeaveQueueButton leaveQueue={leaveQueue} />
              <WithTooltip title="Edit Question">
                <BannerButton
                  data-cy="edit-question"
                  icon={icon(Pencil)}
                  onClick={editQuestion}
                />
              </WithTooltip>
            </>
          }
          content={<QuestionDetailRow studentQuestion={studentQuestion} />}
        />
      );
    default:
      return <div />;
  }
}

function LeaveQueueButton({ leaveQueue }: { leaveQueue: () => void }) {
  return (
    <AlertDialog>
      <Tooltip>
        <TooltipTrigger asChild>
          <AlertDialogTrigger asChild>
            <BannerDangerButton
              data-cy="leave-queue"
              aria-label="Leave Queue"
              icon={icon(ListX)}
            />
          </AlertDialogTrigger>
        </TooltipTrigger>
        <TooltipContent>Leave Queue</TooltipContent>
      </Tooltip>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            Are you sure you want to leave the queue?
          </AlertDialogTitle>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>No</AlertDialogCancel>
          {/* span: Cypress clicks span "Yes", as with the old antd button */}
          <AlertDialogAction onClick={leaveQueue} data-cy="leave-queue-confirm">
            <span>Yes</span>
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function QuestionDetailRow({ studentQuestion }: { studentQuestion: Question }) {
  return (
    <QuestionDetails>
      <ColWithRightMargin style={{ flex: "4 4" }}>
        <InfoHeader>question</InfoHeader>
        <div>{studentQuestion.text}</div>
      </ColWithRightMargin>
      <div style={{ flex: "0.5 0.5 95px" }}>
        <InfoHeader>type</InfoHeader>
        <div>{studentQuestion.questionType}</div>
      </div>
      <div style={{ flex: "0 0 89px" }}>
        <InfoHeader>groupable</InfoHeader>
        <div>
          {studentQuestion.groupable ? (
            <Check className="size-[14px]" aria-label="Yes" />
          ) : (
            <X className="size-[14px]" aria-label="No" />
          )}
        </div>
      </div>
    </QuestionDetails>
  );
}

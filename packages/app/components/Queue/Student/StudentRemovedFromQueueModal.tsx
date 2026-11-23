import { LimboQuestionStatus, Question } from "@koh/common";
import { ReactElement } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogTitle,
} from "@/components/ui/dialog";

type StudentRemovedFromQueueModalProps = {
  question: Question;
  leaveQueue: () => void;
  joinQueue: () => void;
};

export default function StudentRemovedFromQueueModal(
  props: StudentRemovedFromQueueModalProps
): ReactElement {
  return (
    <Dialog open={props.question?.status === LimboQuestionStatus.TADeleted}>
      {/* closable={false}: no close X, and Esc / outside clicks do nothing */}
      <DialogContent
        hideClose
        onEscapeKeyDown={(e) => e.preventDefault()}
        onInteractOutside={(e) => e.preventDefault()}
      >
        {/* The old modal had no title; screen readers still need one */}
        <DialogTitle className="sr-only">
          You&apos;ve been removed from the queue
        </DialogTitle>
        <DialogDescription className="text-foreground">
          You&apos;ve been removed from the queue by a TA. If you have any
          questions, please reach out to the TA. If you&apos;d like to join back
          into the queue with your previous question, click Rejoin Queue,
          otherwise click Leave Queue.
        </DialogDescription>
        <DialogFooter>
          <Button
            variant="destructive"
            data-cy="removed-leave"
            onClick={props.leaveQueue}
          >
            Leave Queue
          </Button>
          <Button data-cy="removed-rejoin" onClick={props.joinQueue}>
            Rejoin Queue
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

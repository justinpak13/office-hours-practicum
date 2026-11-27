import { RephraseQuestionPayload } from "@koh/common";
import React, { ReactElement } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogTitle,
} from "@/components/ui/dialog";

type StudentQuestionRephraseModalProps = {
  payload: RephraseQuestionPayload;
  handleClose: (courseId: number, queueId: number) => void;
};
export default function StudentQuestionRephraseModal({
  payload,
  handleClose,
}: StudentQuestionRephraseModalProps): ReactElement {
  return (
    <Dialog open={true}>
      {/* closable={false}: no close X, and Esc / outside clicks do nothing */}
      <DialogContent
        hideClose
        onEscapeKeyDown={(e) => e.preventDefault()}
        onInteractOutside={(e) => e.preventDefault()}
      >
        {/* The old modal had no title; screen readers still need one */}
        <DialogTitle className="sr-only">
          Please add more detail to your question
        </DialogTitle>
        <DialogDescription className="text-foreground">
          You have been requested to add more detail to your question by a
          member of the course staff. While you elaborate on your question your
          place in line will be reserved.
        </DialogDescription>
        <DialogFooter>
          <Button
            onClick={() => handleClose(payload.courseId, payload.queueId)}
          >
            Edit Question
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

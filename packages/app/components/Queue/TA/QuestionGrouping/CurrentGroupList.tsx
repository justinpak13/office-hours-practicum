import { API } from "@koh/api-client";
import { QuestionGroup } from "@koh/common";
import { Check } from "lucide-react";
import React, { ReactElement } from "react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { FinishHelpingButton } from "../../Banner";
import { Header } from "../TAQueueDetail";
import TAQueueDetailQuestion from "../TAQueueDetailQuestion";
import { Description } from "./AllQuestionsChecklist";

export function CurrentGroupList({
  group,
  queueId,
  courseId,
}: {
  group?: QuestionGroup;
  queueId: number;
  courseId: number;
}): ReactElement {
  return (
    <div>
      <Header>
        <div>
          <strong>{`${group?.creator.name}'s Group Session`}</strong>
          <Description>
            {group?.questions.map((q) => q.creator.name).join(", ")}
          </Description>
        </div>
        <div>
          <Tooltip>
            <TooltipTrigger asChild>
              <FinishHelpingButton
                // The "anticon" span is what Banner's circle buttons centre
                // (antd's now, and the plain buttons from SH-05 / #33)
                icon={
                  <span className="anticon">
                    <Check className="size-[18px]" aria-hidden />
                  </span>
                }
                onClick={() => API.questions.resolveGroup(group?.id, queueId)}
                data-cy="finish-helping-button"
              />
            </TooltipTrigger>
            <TooltipContent>Finish Helping</TooltipContent>
          </Tooltip>
        </div>
      </Header>
      {group?.questions.map((q) => (
        <div key={q.id}>
          <TAQueueDetailQuestion
            courseId={courseId}
            question={q}
            queueId={queueId}
            showName
            showButtons
            hasUnresolvedRephraseAlert={false}
          />
        </div>
      ))}
    </div>
  );
}

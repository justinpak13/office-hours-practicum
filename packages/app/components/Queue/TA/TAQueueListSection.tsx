import { Question } from "@koh/common";
import { ChevronRight } from "lucide-react";
import React, { ReactElement, ReactNode } from "react";
import styled from "styled-components";
import TAQueueListItem from "./TAQueueListItem";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

const Title = styled.div`
  font-size: 16px;
  line-height: 1.5715;
  color: #212934;
  margin-left: 40px;
`;
/**
 * A single section of the list. ie. WaitingInLine
 */
export default function TAQueueListSection({
  title,
  questions,
  onClickQuestion,
  selectedQuestionId,
  showNumbers = false,
  collapsible = false,
  emptyDisplay = null,
}: {
  title: ReactNode;
  questions: Question[];
  onClickQuestion: (questionId: number) => void;
  selectedQuestionId?: number;
  showNumbers?: boolean;
  collapsible?: boolean;
  emptyDisplay?: ReactElement;
}): ReactElement {
  if (questions.length === 0 && !emptyDisplay) {
    return null;
  }
  return (
    // Was an antd ghost Collapse with one panel, open at first. Sections that
    // aren't collapsible can't be closed and have no arrow.
    <Collapsible defaultOpen disabled={!collapsible}>
      <CollapsibleTrigger asChild>
        <button
          type="button"
          className="group flex w-full items-center justify-between border-b border-[#cfd6de] py-3 pr-4 text-left disabled:cursor-auto"
        >
          <Title>
            {title}
            <span>{` (${questions.length})`}</span>
          </Title>
          {collapsible && (
            // Points right when closed and down when open, like antd's
            <ChevronRight
              className="size-3 shrink-0 text-[rgba(0,0,0,0.85)] transition-transform group-data-[state=open]:rotate-90"
              aria-hidden
            />
          )}
        </button>
      </CollapsibleTrigger>
      <CollapsibleContent>
        {questions.length === 0 ? (
          emptyDisplay
        ) : (
          <div>
            {questions.map((q, i) => (
              <TAQueueListItem
                key={q.id}
                question={q}
                index={showNumbers && i + 1}
                selected={selectedQuestionId === q.id}
                onClick={() => onClickQuestion(q.id)}
              />
            ))}
          </div>
        )}
      </CollapsibleContent>
    </Collapsible>
  );
}

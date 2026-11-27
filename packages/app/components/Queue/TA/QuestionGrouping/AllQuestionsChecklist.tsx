import { API } from "@koh/api-client";
import { Question, User } from "@koh/common";
import { Phone } from "lucide-react";
import React, { ReactElement, useState } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import styled from "styled-components";
import { useDefaultMessage } from "../../../../hooks/useDefaultMessage";
import { useTAInQueueInfo } from "../../../../hooks/useTAInQueueInfo";
import { BannerPrimaryButton } from "../../Banner";
import { Header } from "../TAQueueDetail";
import TAQueueListItem from "../TAQueueListItem";
import { useTeams } from "../../../../hooks/useTeams";

export const Description = styled.div`
  font-size: 12px;
  color: #8895a6;
`;
const SelectAllContainer = styled.div`
  padding: 3px 8px;
  border-bottom: 1px solid #cfd6de;
`;
const QuestionsList = styled.div`
  display: flex;
  flex-direction: column;
`;

const RedText = styled.span`
  color: red;
`;

export default function AllQuestionsCheckList({
  groupCreator,
  allQuestions,
  hasMissingQuestions,
  queueId,
  onStartCall,
}: {
  groupCreator: User;
  allQuestions: Question[];
  hasMissingQuestions: boolean;
  queueId: number;
  onStartCall: () => void;
}): ReactElement {
  const [checkedQuestions, setCheckedQuestions] = useState<Set<number>>(
    new Set()
  );
  const { isCheckedIn, isHelping } = useTAInQueueInfo(queueId);
  const [canHelp, helpTooltip] = ((): [boolean, string] => {
    if (!isCheckedIn) {
      return [false, "You must check in to help students!"];
    } else if (isHelping) {
      return [false, "You are already helping a student"];
    } else {
      return [true, "Create Group & Call"];
    }
  })();

  const defaultMessage = useDefaultMessage();

  const onQuestionChecked = (q) => {
    if (!checkedQuestions.has(q.id)) {
      setCheckedQuestions(new Set(checkedQuestions.add(q.id)));
    } else {
      checkedQuestions.delete(q.id);
      setCheckedQuestions(new Set(checkedQuestions));
    }
  };
  const allChecked = allQuestions.length === checkedQuestions.size;
  const someChecked = checkedQuestions.size > 0 && !allChecked;
  // Like antd: clicking a partly-checked "Select All" selects everything
  const onToggleSelectAll = (checked: boolean | "indeterminate") => {
    if (checked === true) {
      setCheckedQuestions(new Set(allQuestions.map((q) => q.id)));
    } else {
      setCheckedQuestions(new Set());
    }
  };

  const usersInLink = allQuestions
    .filter((question) => checkedQuestions.has(question.id))
    .map((question) => question.creator.email)
    .join(",");

  const openTeams = useTeams(queueId, usersInLink, defaultMessage);

  return (
    <div>
      <Header>
        <div>
          <strong>{`${groupCreator.name}'s Group Session`}</strong>
          <Description>
            Select Students to Create Group
            {hasMissingQuestions ? (
              <div>
                <RedText>Note:</RedText> some students may not show up, as they
                did not consent to being grouped
              </div>
            ) : null}
          </Description>
        </div>
        <div>
          <Tooltip>
            {/* The span gets the hover even while the button is disabled */}
            <TooltipTrigger asChild>
              <span className="inline-block">
                <BannerPrimaryButton
                  // The "anticon" span is what Banner's circle buttons centre
                  // (antd's now, and the plain buttons from SH-05 / #33)
                  icon={
                    <span className="anticon">
                      <Phone className="size-[18px]" aria-hidden />
                    </span>
                  }
                  onClick={() => {
                    API.questions.group({
                      questionIds: Array.from(checkedQuestions),
                      queueId: queueId,
                    });
                    onStartCall();
                    openTeams();
                  }}
                  disabled={!canHelp || checkedQuestions.size === 0}
                  data-cy="help-student"
                />
              </span>
            </TooltipTrigger>
            <TooltipContent>{helpTooltip}</TooltipContent>
          </Tooltip>
        </div>
      </Header>
      <SelectAllContainer>
        {/* Was an antd Checkbox with a label: the label text is clickable too */}
        <label className="inline-flex cursor-pointer items-center align-top leading-[1.5715]">
          <Checkbox
            checked={allChecked ? true : someChecked ? "indeterminate" : false}
            onCheckedChange={onToggleSelectAll}
          />
          <span className="px-2">
            <span className="pl-[9px]">Select All</span>
          </span>
        </label>
      </SelectAllContainer>
      <QuestionsList>
        {allQuestions.map((q, i) => (
          <div key={q.id}>
            <TAQueueListItem
              question={q}
              index={i + 1}
              selected={checkedQuestions.has(q.id)}
              onClick={() => onQuestionChecked(q)}
              showCheckbox
            />
          </div>
        ))}
      </QuestionsList>
    </div>
  );
}

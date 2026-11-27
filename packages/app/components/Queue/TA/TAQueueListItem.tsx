import { OpenQuestionStatus, Question } from "@koh/common";
import { CircleQuestionMark, Hourglass } from "lucide-react";
import React, { ReactElement } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import styled from "styled-components";
import { getWaitTime } from "../../../utils/TimeUtil";
import { KOHAvatar } from "../../common/SelfAvatar";
import { truncate } from "../QueueUtils";
import { RenderEvery } from "../../RenderEvery";

export const Container = styled.div<{ selected: boolean }>`
  display: flex;
  align-items: center;
  width: 100%;

  padding-top: 16px;
  padding-bottom: 12px;
  border-bottom: 1px solid #cfd6de;
  background: ${({ selected }) => (selected ? "#EFF8FF" : "white")};

  cursor: pointer;
  &:hover {
    background: ${({ selected }) => (selected ? "#EFF8FF" : "#ECF0F3")};
  }
`;
const BodyContainer = styled.div`
  display: flex;
  align-items: flex-start;
`;
const AvatarContainer = styled.div`
  margin: 10px 12px 0 25px;
  display: block;
`;
const QuestionInfoContainer = styled.div``;

const Name = styled.div`
  color: #212934;
`;
const QuestionText = styled.div`
  padding-right: 8px;
  color: #595959;
`;

export default function TAQueueListItem({
  index,
  selected,
  question,
  onClick,
  showCheckbox,
}: {
  index: number | false;
  selected: boolean;
  question: Question;
  onClick: () => void;
  showCheckbox?: boolean;
}): ReactElement {
  const isDrafting = question.status === OpenQuestionStatus.Drafting;

  const buildMetaInfo = (): [ReactElement, string][] => {
    const metaInfo: [ReactElement, string][] = [
      [
        <Hourglass key="h" className="size-3.5" aria-hidden />,
        getWaitTime(question),
      ],
    ];
    if (!isDrafting) {
      metaInfo.push([
        <CircleQuestionMark key="q" className="size-3.5" aria-hidden />,
        question.questionType,
      ]);
    }
    return metaInfo;
  };
  return (
    <Container
      selected={selected}
      data-cy={`queue-list-item-${question.id}`}
      onClick={onClick}
    >
      {/* Shows the selection; the row's onClick does the selecting */}
      {showCheckbox && (
        <Checkbox checked={selected} className="ml-2" tabIndex={-1} />
      )}
      <BodyContainer>
        <AvatarContainer>
          {/* Was antd <Badge count offset={[-40, 0]}>: the place number,
              centered on the avatar's top-left corner */}
          <span className="relative inline-block leading-none">
            <KOHAvatar
              size={40}
              name={question.creator.name}
              photoURL={question.creator.photoURL}
            />
            {index ? (
              <span className="absolute right-10 top-0 z-[1] h-5 min-w-5 -translate-y-1/2 translate-x-1/2 whitespace-nowrap rounded-[10px] bg-[#3684c6] px-2 text-center text-xs font-normal leading-5 text-white shadow-[0_0_0_1px_#fff]">
                #{index}
              </span>
            ) : null}
          </span>
        </AvatarContainer>
        <QuestionInfoContainer>
          <Name>{question.creator.name}</Name>
          <QuestionText>
            {isDrafting ? (
              <i>Still Drafting...</i>
            ) : (
              truncate(question.text, 80)
            )}
          </QuestionText>
          <RenderEvery
            render={() => <QuestionMetaRow info={buildMetaInfo()} />}
            interval={60 * 1000}
          />
        </QuestionInfoContainer>
      </BodyContainer>
    </Container>
  );
}

/**
 * Row of the meta info. Icon and text pairs separated by dividers.
 */
const RowContainer = styled.div`
  margin-top: 8px;
  display: flex;
  align-items: center;
  color: #8895a6;
`;
const Divider = styled.div`
  margin-left: 12px;
  margin-right: 8px;
`;
const Spacer = styled.div`
  margin-left: 5px;
`;
function QuestionMetaRow({
  info,
}: {
  info: [ReactElement, string][];
}): ReactElement {
  return (
    <RowContainer>
      {info
        .map(([icon, text], i) => [
          i > 0 && <Divider key={text}>|</Divider>,
          icon,
          <Spacer key={text + "space"} />,
          text,
        ])
        .flat()
        .filter((e) => !!e)}
    </RowContainer>
  );
}

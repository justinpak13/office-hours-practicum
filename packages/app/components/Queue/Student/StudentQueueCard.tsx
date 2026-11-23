import { Question } from "@koh/common";
import { ReactElement } from "react";
import styled from "styled-components";
import { getWaitTime } from "../../../utils/TimeUtil";
import { Text } from "../QueueCardSharedComponents";
import { truncate } from "../QueueUtils";
import { RenderEvery } from "../../RenderEvery";

// Same box as the old antd Card: 1px border, 24px body padding (plus 8px sides)
const HorizontalStudentCard = styled.div`
  margin-bottom: 8px;
  box-shadow: 0px 2px 8px rgba(0, 0, 0, 0.15);
  background: #ffffff;
  border: 1px solid #f0f0f0;
  border-radius: 6px;
  padding: 24px 32px;
  color: #595959;
`;

// The old card dropped its border when highlighted (bordered={false})
const highlightedStyle = {
  backgroundColor: "#F6FFED",
  border: "none",
};

interface StudentQueueCardProps {
  question: Question;
  rank: number;
  highlighted: boolean;
}

/**
 * Renders the queue card and its contents for a student viewing.
 */
export default function StudentQueueCard({
  question,
  rank,
  highlighted,
}: StudentQueueCardProps): ReactElement {
  return (
    <HorizontalStudentCard style={highlighted ? highlightedStyle : {}}>
      <div className="flex flex-wrap items-center">
        <div className="shrink-0 grow-0 basis-16">
          <Text>{rank}</Text>
        </div>
        <div className="min-w-0 flex-1">
          <Text>{truncate(question.text, 150)}</Text>
        </div>
        <div className="shrink-0 grow-0 basis-20">
          <RenderEvery
            render={() => <Text>{getWaitTime(question)}</Text>}
            interval={60 * 1000}
          />
        </div>
      </div>
    </HorizontalStudentCard>
  );
}

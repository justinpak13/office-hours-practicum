import { Question } from "@koh/common";
import React, { ReactElement } from "react";
import styled from "styled-components";
import TAQueueDetailButtons from "./TAQueueDetailButtons";
import TAQueueDetailQuestion from "./TAQueueDetailQuestion";

const Container = styled.div``;

// min-height, not height: in a narrow panel the buttons wrap onto more rows,
// and a fixed height pushed the top row out of view
export const Header = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 8px;
  min-height: 60px;
  padding: 8px 12px;
  background: #e1e7ec;
`;
const Student = styled.div`
  min-width: 0;
`;
const Email = styled.div`
  font-size: 12px;
  color: #8895a6;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;
const Actions = styled.div`
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  row-gap: 8px;
`;

/**
 *  Details about the stuent's question
 */
export default function TAQueueDetail({
  courseId,
  queueId,
  question,
  hasUnresolvedRephraseAlert,
}: {
  courseId: number;
  queueId: number;
  question: Question;
  hasUnresolvedRephraseAlert: boolean;
}): ReactElement {
  return (
    <Container>
      <Header>
        <Student>
          <strong>{question.creator.name}</strong>
          <Email title={question.creator.email}>{question.creator.email}</Email>
        </Student>
        <Actions>
          <TAQueueDetailButtons
            courseId={courseId}
            queueId={queueId}
            question={question}
            hasUnresolvedRephraseAlert={hasUnresolvedRephraseAlert}
          />
        </Actions>
      </Header>
      <TAQueueDetailQuestion
        courseId={courseId}
        question={question}
        queueId={queueId}
        hasUnresolvedRephraseAlert={hasUnresolvedRephraseAlert}
      />
    </Container>
  );
}

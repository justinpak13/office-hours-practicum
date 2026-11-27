import { ReactElement } from "react";
import { Plus } from "lucide-react";
import styled from "styled-components";
import { Container } from "../TAQueueListItem";

const EmptyGroupListContainer = styled(Container)`
  display: flex;
  justify-content: space-between;
  align-items: center;
`;

const EmptyGroupListText = styled.div`
  font-weight: bold;
  padding: 15px;
  padding-left: 35px;
  font-size: 16px;
`;

/**
 * Component to add participants to an empty Question Group
 */
export default function EmptyGroupList({
  onClick,
}: {
  onClick: () => void;
}): ReactElement {
  return (
    <EmptyGroupListContainer
      onClick={onClick}
      selected={false}
      data-cy={`queue-list-item-question-group`}
    >
      <EmptyGroupListText>Add Students</EmptyGroupListText>
      <Plus className="mr-4 size-3.5 shrink-0" aria-hidden />
    </EmptyGroupListContainer>
  );
}

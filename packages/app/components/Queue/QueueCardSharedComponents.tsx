import { QuestionStatus, QuestionStatusKeys } from "@koh/common";
import styled from "styled-components";

// The antd-based HorizontalTACard, StatusTag and CenterRow were removed in
// SH-05: nothing imported them.

export const Rank = styled.div`
  font-size: 14px;
  line-height: 22px;
  font-weight: 500;
  color: #595959;
`;

export const Text = styled.div`
  font-size: 14px;
  line-height: 22px;
  color: #595959;
`;

export function questionStatusToColor(status: QuestionStatus): string {
  switch (status) {
    case QuestionStatusKeys.Helping:
      return "gold";
    case QuestionStatusKeys.CantFind:
    case QuestionStatusKeys.TADeleted:
      return "red";
    case QuestionStatusKeys.Drafting:
      return "blue";
    case QuestionStatusKeys.PriorityQueued:
      return "green";
    default:
      return "purple";
  }
}

export function questionStatusToText(status: QuestionStatus): string {
  switch (status) {
    case QuestionStatusKeys.CantFind:
      return "Can't Find";
    case QuestionStatusKeys.PriorityQueued:
      return "Priority";
    default:
      return status;
  }
}

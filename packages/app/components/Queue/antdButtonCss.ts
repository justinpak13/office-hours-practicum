import { css } from "styled-components";

// antd's default and large button styles (antd 4.24's antd.css, plus our
// global .ant-btn-primary colour), so the shared queue buttons look and behave
// exactly as before while they no longer use antd. Specificity matches antd's:
// hover/focus and disabled rules beat a styled(...) wrapper's plain colours,
// and a wrapper's own &:hover still wins over the default hover.
// Delete with the rest of antd (SH-12) once nothing needs to match it.
export const antdButtonBase = css`
  position: relative;
  display: inline-block;
  font-weight: 400;
  line-height: 1.5715;
  white-space: nowrap;
  text-align: center;
  background-image: none;
  border: 1px solid #d9d9d9;
  box-shadow: 0 2px 0 rgba(0, 0, 0, 0.015);
  cursor: pointer;
  transition: all 0.3s cubic-bezier(0.645, 0.045, 0.355, 1);
  user-select: none;
  touch-action: manipulation;
  color: rgba(0, 0, 0, 0.85);
  background: #fff;
  outline: 0;
  font-family: inherit;

  &:hover,
  &:focus {
    color: #40a9ff;
    border-color: #40a9ff;
    background: #fff;
  }
  &:active {
    color: #096dd9;
    border-color: #096dd9;
    background: #fff;
  }
  /* antd shows no focus ring; keep one for keyboard users only */
  &:focus-visible {
    outline: 2px solid #3684c6;
    outline-offset: 2px;
  }
  &[disabled],
  &[disabled]:hover,
  &[disabled]:focus,
  &[disabled]:active {
    cursor: not-allowed;
    color: rgba(0, 0, 0, 0.25);
    border-color: #d9d9d9;
    background: #f5f5f5;
    text-shadow: none;
    box-shadow: none;
  }
  &[disabled] > * {
    pointer-events: none;
  }
  & > span {
    display: inline-block;
  }
`;

// type="primary"
export const antdButtonPrimary = css`
  color: #fff;
  border-color: #3684c6;
  background: #3684c6;
  text-shadow: 0 -1px 0 rgba(0, 0, 0, 0.12);
  box-shadow: 0 2px 0 rgba(0, 0, 0, 0.045);

  &:hover,
  &:focus {
    color: #fff;
    border-color: #40a9ff;
    background: #40a9ff;
  }
  &:active {
    color: #fff;
    border-color: #096dd9;
    background: #096dd9;
  }
`;

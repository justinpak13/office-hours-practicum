import React, { ReactElement, ReactNode } from "react";
import styled from "styled-components";
import { antdButtonBase } from "./antdButtonCss";

const BannerContainer = styled.div`
  width: 100%;
`;

const TitleContainer = styled.div`
  background: ${({ color }) => color || "#8895A6"};
  padding-left: 24px;
  padding-right: 16px;
  min-height: 60px;
  border-radius: 6px 6px 0 0;
  position: relative;
  box-shadow: 0px 2px 8px rgba(0, 0, 0, 0.15);

  display: flex;
  align-items: center;
  justify-content: space-between;
`;
const Title = styled.div`
  font-weight: 300;
  font-size: 24px;
  color: white;
`;
const ButtonContainer = styled.div`
  display: flex;
  flex-flow: row wrap;
  margin-right: 10px;
`;

const ContentContainer = styled.div`
  background: ${({ color }) => color || "#CFD6DE"};
  padding: 12px 24px;
  border-radius: 0 0 6px 6px;
`;

interface BannerProps {
  title?: string | ReactNode;
  content?: string | ReactNode;
  titleColor?: string;
  contentColor?: string;
  buttons?: ReactNode;
}

type CircleButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  icon?: ReactNode;
  /** antd prop from the TA screens; these buttons are always circles */
  shape?: string;
  "data-cy"?: string;
};

// antd's large circle icon button (40px), without antd
const CircleButtonBase = styled.button`
  ${antdButtonBase}
  width: 40px;
  min-width: 40px;
  height: 40px;
  padding: 4.9px 0;
  font-size: 18px;
  border-radius: 50%;

  /* the TA screens still pass antd icons: keep them centred as antd did */
  & > .anticon {
    display: flex;
    justify-content: center;
    line-height: 1;
  }
`;
/**
 * Presentation-only component
 */
export default function Banner(props: BannerProps): ReactElement {
  return (
    <BannerContainer data-cy="banner">
      <TitleContainer color={props.titleColor}>
        <Title>{props.title}</Title>
        <ButtonContainer>{props.buttons}</ButtonContainer>
      </TitleContainer>
      <ContentContainer color={props.contentColor}>
        {props.content}
      </ContentContainer>
    </BannerContainer>
  );
}

// forwardRef so shadcn Tooltip / AlertDialog triggers (asChild) can wrap
// these buttons; antd's own Tooltip and Popconfirm keep working as before
export const CircleButton = React.forwardRef<
  HTMLButtonElement,
  CircleButtonProps
>(function CircleButton(
  // shape is antd's; these buttons are always circles, so drop it
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  { icon, shape, type, children, ...props }: CircleButtonProps,
  ref: React.ForwardedRef<HTMLButtonElement>
) {
  return (
    <CircleButtonBase ref={ref} type={type ?? "button"} {...props}>
      {icon}
      {children}
    </CircleButtonBase>
  );
});
// antd's Tooltip only shows on a disabled button it recognises as its own
// (it wraps it in a span). The TA screens rely on that ("You must check in to
// help students!"), so keep the flag until SH-06 replaces their antd Tooltips.
(CircleButton as unknown as { __ANT_BUTTON: boolean }).__ANT_BUTTON = true;

/**
 * Buttons to be used in the banner
 */
export const BannerButton = styled(CircleButton)`
  margin-left: 16px;
  border: 0;
  background: #fff;
`;

export const BannerPrimaryButton = styled(BannerButton)`
  ${({ disabled }) => disabled && "pointer-events: none"};
  background: #3684c6;
  color: #fff;
  &:hover,
  &:focus {
    background: #3c93dd;
    color: #fff;
  }
`;

export const BannerDangerButton = styled(BannerButton)`
  ${({ disabled }) => disabled && "pointer-events: none"};
  background: #e26567;
  color: #fff;
  &:hover,
  &:focus {
    background: #fc7f81;
    color: #fff;
  }
`;

export const BannerOrangeButton = styled(BannerButton)`
  ${({ disabled }) => disabled && "pointer-events: none"};
  background: #ff8c00;
  color: #fff;
  &:hover,
  &:focus {
    background: #ffa700;
    color: #fff;
  }
`;

export const FinishHelpingButton = styled(BannerButton)`
  border: 0;
  background: #66bb6a;
  color: #fff;
  &:hover,
  &:focus {
    background: #82c985;
    color: #fff;
  }
`;

export const CantFindButton = styled(BannerButton)`
  background: #fff;
  border: 1px solid #e26567;
  color: #e26567;
  &:hover,
  &:focus {
    background: #fc7f81;
    color: #fff;
  }
`;

export const RequeueButton = styled(BannerButton)`
  background: #ffffff;
  border: 1px solid #f0f0f0;
  color: #000000;
  &:hover,
  &:focus {
    background: #f0f0f0;
    color: #000000;
  }
`;

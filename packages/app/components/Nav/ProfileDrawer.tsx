import {
  LogoutOutlined,
  MacCommandOutlined,
  QuestionCircleOutlined,
  ReadOutlined,
  SettingOutlined,
} from "@ant-design/icons";
import { Menu, Modal, Popover, Typography, Space } from "antd";
import axios from "axios";
import Link from "next/link";
import React, { ReactElement, ReactNode, useState } from "react";
import styled from "styled-components";
import SelfAvatar from "../common/SelfAvatar";
import { useRoleInCourse } from "../../hooks/useRoleInCourse";
import { Role } from "@koh/common";
const { Text } = Typography;

const StyleablePopover = ({ className, ...props }: { className: string }) => (
  <Popover {...props} overlayClassName={className} />
);
const NoPaddingPopover: typeof Popover = styled(StyleablePopover)`
  & .ant-popover-inner-content {
    padding: 0px;
  }
`;

const AvatarButton = styled.div`
  cursor: pointer;
`;

interface ProfileDrawerProps {
  courseId: number;
}

function shortcutInfoContent(role: Role): ReactNode {
  if (role === Role.STUDENT) {
    return (
      <Space direction="vertical" style={{ display: "flex" }}>
        <Space>
          <Text keyboard>shift</Text>
          <Text keyboard>n</Text>Create a new question
        </Space>
        <Space>
          <Text keyboard>shift</Text>
          <Text keyboard>e</Text>Edit question
        </Space>
        <Space size={40}>
          <Text keyboard>enter</Text>Finish writing question
        </Space>
      </Space>
    );
  } else {
    return (
      <Space direction="vertical" style={{ display: "flex" }}>
        <Space>
          <Text keyboard>shift</Text>
          <Text keyboard>h</Text>Help the next student
        </Space>
        <Space>
          <Text keyboard>shift</Text>
          <Text keyboard>d</Text>Delete the currently selected student&apos;s
          question
        </Space>
        <Space>
          <Space size={1}>
            <Text keyboard>up</Text>/<Text keyboard>down</Text>
          </Space>
          Navigate through students
        </Space>
      </Space>
    );
  }
}

export default function ProfileDrawer({
  courseId,
}: ProfileDrawerProps): ReactElement {
  const [isPopoverOpen, setIsPopoverOpen] = useState(false);
  const role = useRoleInCourse(courseId);

  return (
    <>
      <NoPaddingPopover
        content={
          isPopoverOpen && (
            <Menu mode="inline">
              <Menu.Item icon={<SettingOutlined />}>
                <Link
                  href={{ pathname: "/settings", query: { cid: courseId } }}
                >
                  Settings
                </Link>
              </Menu.Item>
              <Menu.Item
                icon={<MacCommandOutlined />}
                onClick={() => {
                  Modal.info({
                    title: "Queue Page Keyboard Shortcuts",
                    content: shortcutInfoContent(role),
                  });
                  setIsPopoverOpen(false);
                }}
              >
                Keyboard Shortcuts
              </Menu.Item>
              <Menu.Item
                key="1"
                icon={<QuestionCircleOutlined />}
                onClick={() => {
                  window.open("https://sandboxnu.notion.site/Khoury-Office-Hours-App-6eb1ee9f338f4b859cd89054f6503f43");
                  setIsPopoverOpen(false);
                }}
              >
                Help Guide
              </Menu.Item>
              <Menu.Item key="3" icon={<ReadOutlined />}>
                <Link href={"/about"}>
                  About Us
                </Link>
              </Menu.Item>
              <Menu.Item key="4" icon={<LogoutOutlined />}>
                <a
                  data-cy="logout-button"
                  onClick={async () => {
                    await axios.post("/api/v1/logout");
                    window.location.href = "/login";
                  }}
                >
                  Logout
                </a>
              </Menu.Item>
            </Menu>
          )
        }
        placement="bottomRight"
        trigger="click"
        visible={isPopoverOpen}
        onVisibleChange={setIsPopoverOpen}
      >
        <AvatarButton>
          <SelfAvatar size={40} />
        </AvatarButton>
      </NoPaddingPopover>
    </>
  );
}

import { BellOutlined, EditOutlined, BookOutlined } from "@ant-design/icons";
import { Col, Menu, Row, Space } from "antd";
import React, { ReactElement, useState } from "react";
import styled from "styled-components";
import { useProfile } from "../../hooks/useProfile";
import CourseRosterPage from "./CourseRosterPage";
import { SettingsPanelAvatar } from "./SettingsSharedComponents";
import TACheckInCheckOutTimes from "./TACheckInCheckOutTimes";
import CourseInformation from "./CourseInformation";

export enum CourseAdminOptions {
  CHECK_IN = "CHECK_IN",
  INFO = "INFO",
  ROSTER = "ROSTER",
}

interface CourseAdminPageProps {
  defaultPage: CourseAdminOptions;
  courseId: number;
}

const VerticalDivider = styled.div`
  @media (min-width: 767px) {
    border-right: 1px solid #cfd6de;
    margin-right: 32px;
  }
`;

const CenteredText = styled.p`
  text-align: center;
`;

export default function CourseAdminPanel({
  defaultPage,
  courseId,
}: CourseAdminPageProps): ReactElement {
  const profile = useProfile();
  const [currentSettings, setCurrentSettings] = useState(
    defaultPage || CourseAdminOptions.CHECK_IN
  );

  return (
    <Row>
      <Col span={4} style={{ textAlign: "center" }}>
        <SettingsPanelAvatar avatarSize={20} />
        <CenteredText>
          Welcome back
          <br />
          {profile?.firstName} {profile?.lastName}
        </CenteredText>
        <Menu
          defaultSelectedKeys={[currentSettings]}
          onClick={(e) => setCurrentSettings(e.key as CourseAdminOptions)}
          style={{ background: "#f8f9fb", paddingTop: "20px" }}
        >
          <Menu.Item
            key={CourseAdminOptions.CHECK_IN}
            icon={<EditOutlined />}
            data-cy="admin-menu-check-in"
          >
            TA Check In/Out Times
          </Menu.Item>
          <Menu.Item
            key={CourseAdminOptions.ROSTER}
            icon={<BellOutlined />}
            data-cy="admin-menu-roster"
          >
            Course Roster
          </Menu.Item>
          <Menu.Item
            key={CourseAdminOptions.INFO}
            icon={<BookOutlined />}
            data-cy="admin-menu-info"
          >
            Course Information
          </Menu.Item>
        </Menu>
      </Col>
      <VerticalDivider />
      <Space direction="vertical" size={40} style={{ flexGrow: 1 }}>
        <Col span={20}>
          {currentSettings === CourseAdminOptions.INFO && (
            <CourseInformation courseId={courseId} />
          )}
          {currentSettings === CourseAdminOptions.CHECK_IN && (
            <TACheckInCheckOutTimes courseId={courseId} />
          )}
          {currentSettings === CourseAdminOptions.ROSTER && (
            <CourseRosterPage courseId={courseId} />
          )}
        </Col>
      </Space>
    </Row>
  );
}

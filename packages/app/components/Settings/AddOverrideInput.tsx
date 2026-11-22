import { API } from "@koh/api-client";
import { Role, UpdateCourseOverrideResponse } from "@koh/common";
import { Button, Input, message, Select } from "antd";
import React, { ReactElement, useState } from "react";
import styled from "styled-components";

const OverrideInput = styled.div`
  display: flex;
  margin-bottom: 20px;
`;

type AddOverrideInputProps = {
  courseId: number;
  onAddOverride: (ovr: UpdateCourseOverrideResponse) => void;
};

export default function AddOverrideInput({
  courseId,
  onAddOverride,
}: AddOverrideInputProps): ReactElement {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState(Role.STUDENT);

  const addOverride = async () => {
    try {
      const resp = await API.course.addOverride(courseId, { email, role });
      onAddOverride(resp);
      setEmail("");
      message.success("Successfully added an override for " + resp.name);
    } catch (e) {
      message.error(e.response?.data?.message);
    }
  };

  return (
    <div>
      <OverrideInput>
        <Input
          placeholder="Email"
          style={{ marginRight: 10 }}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          data-cy="override-email"
        />
        <Select
          style={{ width: 120, marginRight: 10 }}
          value={role}
          onChange={(e) => setRole(e)}
          data-cy="override-role"
        >
          <Select.Option value={Role.STUDENT} data-cy="override-role-student">
            Student
          </Select.Option>
          <Select.Option value={Role.TA} data-cy="override-role-ta">
            TA
          </Select.Option>
          <Select.Option
            value={Role.PROFESSOR}
            data-cy="override-role-professor"
          >
            Professor
          </Select.Option>
        </Select>
        <Button type="primary" onClick={addOverride} data-cy="add-override">
          Add Override
        </Button>
      </OverrideInput>
    </div>
  );
}

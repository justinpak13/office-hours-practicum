import { API } from "@koh/api-client";
import { Role, UpdateCourseOverrideResponse } from "@koh/common";
import React, { ReactElement, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

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
      toast.success("Successfully added an override for " + resp.name);
    } catch (e) {
      toast.error(e.response?.data?.message || "Failed to add the override");
    }
  };

  return (
    <div>
      {/* On narrow screens the row wraps rather than squeezing the email box */}
      <div className="mb-5 flex flex-wrap gap-2.5">
        <Input
          placeholder="Email"
          className="min-w-[8rem] flex-1"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          data-cy="override-email"
        />
        <Select value={role} onValueChange={(v) => setRole(v as Role)}>
          <SelectTrigger
            aria-label="Role"
            className="w-[120px] shrink-0"
            data-cy="override-role"
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={Role.STUDENT} data-cy="override-role-student">
              Student
            </SelectItem>
            <SelectItem value={Role.TA} data-cy="override-role-ta">
              TA
            </SelectItem>
            <SelectItem
              value={Role.PROFESSOR}
              data-cy="override-role-professor"
            >
              Professor
            </SelectItem>
          </SelectContent>
        </Select>
        <Button
          className="shrink-0"
          onClick={addOverride}
          data-cy="add-override"
        >
          Add Override
        </Button>
      </div>
    </div>
  );
}

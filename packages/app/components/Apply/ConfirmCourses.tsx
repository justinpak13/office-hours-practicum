import { ReactElement } from "react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { RegisterCourseInfo, createSGString, Highlight } from "./ApplyPage";
import { TimezoneCampusMapping } from "./EditCourse";

interface ConfirmCourseProps {
  courses: RegisterCourseInfo[];
  onSubmit: () => any;
  onBack: () => any;
}

const FormattedCourseInfo = ({
  label,
  info,
}: {
  label: string;
  info: string;
}) => (
  <p style={{ margin: "0.5em" }}>
    <b>
      <i>{label}</i>
    </b>
    {info}
  </p>
);

const FormattedCourse = ({ course }: { course: RegisterCourseInfo }) => (
  <div style={{ padding: "0.2em 0" }}>
    <h3>
      <Highlight>{createSGString(course)}</Highlight>
    </h3>
    <FormattedCourseInfo
      label="Course Display Name: "
      info={course.displayName}
    />
    <FormattedCourseInfo
      label="Campus: "
      info={TimezoneCampusMapping[course.timezone]}
    />
    <FormattedCourseInfo
      label="Coordinator Email: "
      info={course.coordinator_email}
    />
    <FormattedCourseInfo
      label="Office Hours Calendar URL: "
      info={course.iCalURL}
    />
  </div>
);

export default function ConfirmCourses({
  courses,
  onSubmit,
  onBack,
}: ConfirmCourseProps): ReactElement {
  return (
    <div>
      {courses.length === 0 ? (
        <h3>Continue without registering new courses?</h3>
      ) : (
        <>
          <h3>
            Please confirm all the information is correct before submitting:
          </h3>
          {courses.map((course, index) => (
            <div key={course.name}>
              {index > 0 && <Separator className="my-6 bg-[#d9d9d9]" />}
              <FormattedCourse course={course} />
            </div>
          ))}
        </>
      )}
      <div className="mt-[1.5em] flex gap-2">
        <Button variant="outline" onClick={onBack}>
          Back
        </Button>
        <Button onClick={onSubmit}>Submit</Button>
      </div>
    </div>
  );
}

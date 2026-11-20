import { API } from "@koh/api-client";
import { CircleAlert } from "lucide-react";
import Router from "next/router";
import { ReactElement } from "react";
import useSWR from "swr";
import { logout } from "../utils/logout";
import { Button } from "@/components/ui/button";
import { useHomePageRedirect } from "../hooks/useHomePageRedirect";

export default function NoCourses(): ReactElement {
  useHomePageRedirect();

  const { data } = useSWR("/api/v1/courses/self_enroll_courses", async () =>
    API.course.selfEnrollCourses()
  );

  return (
    <div>
      {/* was antd <Result status="info">: icon, title, subtitle */}
      <div className="px-8 py-12 text-center">
        <CircleAlert
          className="mx-auto mb-6 block size-[72px] fill-primary text-primary-foreground"
          aria-hidden
        />
        <h2 className="m-0 text-2xl font-normal leading-[1.8] text-foreground">
          None of your courses are using the Khoury Office Hours App.
        </h2>
        <p className="m-0 text-sm leading-[1.6] text-muted-foreground">
          If you expected your course to be here, try logging in again. If it
          still does not appear, please reach out to your course coordinator or
          professor.
        </p>
      </div>
      {data?.courses.length > 0 ? (
        <div style={{ textAlign: "center" }}>
          One of our data sources for student-enrollment is currently
          experiencing an outage. If you think you belong to a class, please
          click on your corresponding class below.
          <div>
            {data?.courses.map((course, i) => {
              return (
                <Button
                  key={i}
                  variant="outline"
                  onClick={async () => {
                    await API.course.createSelfEnrollOverride(course.id);
                    Router.push("/login");
                  }}
                >
                  {course.name}
                </Button>
              );
            })}
          </div>
        </div>
      ) : null}
      <Button
        data-cy="logout-button"
        className="mx-auto flex w-[200px]"
        onClick={logout}
      >
        Logout
      </Button>
    </div>
  );
}

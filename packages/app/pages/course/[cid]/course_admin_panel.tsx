import { Role } from "@koh/common";
import DefaultErrorPage from "next/error";
import Head from "next/head";
import { useRouter } from "next/router";
import React, { ReactElement } from "react";
import { StandardPageContainer } from "../../../components/common/PageContainer";
import NavBar from "../../../components/Nav/NavBar";
import CourseAdminPanel, {
  CourseAdminOptions,
} from "../../../components/Settings/CourseAdminPanel";
import { useProfile } from "../../../hooks/useProfile";
import { useRoleInCourse } from "../../../hooks/useRoleInCourse";

export default function CourseAdminPanelPage(): ReactElement {
  const router = useRouter();
  const courseId = router.query["cid"];
  const profile = useProfile();
  const role = useRoleInCourse(Number(courseId));
  const defaultPage = router.query["defaultPage"] as CourseAdminOptions;

  // The role is undefined until the profile loads; wait rather than 404
  if (!profile) {
    return null;
  }
  if (role !== Role.PROFESSOR) {
    return <DefaultErrorPage statusCode={404} />;
  }

  return (
    <div>
      <StandardPageContainer>
        <Head>
          <title>Course Admin Panel | Khoury Office Hours</title>
        </Head>
        <NavBar courseId={Number(courseId)} />
        {courseId && (
          <CourseAdminPanel
            courseId={Number(courseId)}
            defaultPage={defaultPage}
          />
        )}
      </StandardPageContainer>
    </div>
  );
}

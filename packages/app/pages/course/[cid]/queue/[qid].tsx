import { Role } from "@koh/common";
import DefaultErrorPage from "next/error";
import Head from "next/head";
import { useRouter } from "next/router";
import React, { ReactElement } from "react";
import styled from "styled-components";
import { StandardPageContainer } from "../../../../components/common/PageContainer";
import NavBar from "../../../../components/Nav/NavBar";
import StudentQueue from "../../../../components/Queue/Student/StudentQueue";
import TAQueue from "../../../../components/Queue/TA/TAQueue";
import { useProfile } from "../../../../hooks/useProfile";
import { useQueue } from "../../../../hooks/useQueue";
import { useRoleInCourse } from "../../../../hooks/useRoleInCourse";

const Container = styled.div`
  flex: 1;
  display: flex;
  flex-direction: column;
`;
export default function Queue(): ReactElement {
  const router = useRouter();
  const { cid, qid } = router.query;
  const profile = useProfile();
  const role = useRoleInCourse(Number(cid));
  const { queue } = useQueue(Number(qid));

  return (
    <StandardPageContainer>
      <Container>
        <Head>
          <title>{queue?.room} Queue | Khoury Office Hours</title>
        </Head>
        <NavBar courseId={Number(cid)} />
        {/* Pick the view only once the role is known. Until the profile
            loads the role is undefined, which must not show the TA view. */}
        {!profile ? null : role === Role.STUDENT ? (
          <StudentQueue qid={Number(qid)} cid={Number(cid)} />
        ) : role === Role.TA || role === Role.PROFESSOR ? (
          <TAQueue qid={Number(qid)} courseId={Number(cid)} />
        ) : (
          <DefaultErrorPage statusCode={404} />
        )}
      </Container>
    </StandardPageContainer>
  );
}

import { API } from "@koh/api-client";
import { isProd } from "@koh/common";
import DefaultErrorPage from "next/error";
import React, { ReactElement } from "react";
import styled from "styled-components";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";

const Container = styled.div`
  width: auto;
  height: auto;
  @media (max-width: 768px) {
    margin: 32px 24px;
  }
`;

const LoginContainer = styled.div`
  margin-left: auto;
  margin-right: auto;
  text-align: center;

  padding-top: 100px;
`;

const SeedingContainer = styled.div`
  margin-left: auto;
  margin-right: auto;
  text-align: center;

  padding-top: 20px;
`;

const PageHeader = styled.div`
  display: flex;
  justify-content: center;
  margin-top: 40px;
`;

// antd <Divider plain> with a title: a line on each side of the text
function SectionDivider({ children }: { children: React.ReactNode }) {
  return (
    <div className="my-4 flex items-center whitespace-nowrap">
      <Separator className="flex-1" />
      <span className="inline-block px-[1em]">{children}</span>
      <Separator className="flex-1" />
    </div>
  );
}

const DEV_LOGINS = [
  { userId: 1, label: "Student 1" },
  { userId: 2, label: "Student 2" },
  { userId: 3, label: "TA" },
  { userId: 4, label: "TA 2" },
  { userId: 5, label: "Professor " },
  { userId: 6, label: "No Course User" },
];

export default function DevPanel(): ReactElement {
  if (isProd()) {
    return <DefaultErrorPage statusCode={404} />;
  }
  return (
    <Container>
      <h1>
        <PageHeader>[ For Development Use Only ]</PageHeader>
      </h1>
      <LoginContainer>
        <SectionDivider>
          <h3>Login</h3>
        </SectionDivider>
        {DEV_LOGINS.map(({ userId, label }) => (
          <Button
            key={userId}
            asChild
            variant="outline"
            className="mr-[15px] text-foreground"
          >
            <a href={`/api/v1/login/dev?userId=${userId}`}>
              {/* one child, so the button's icon gap doesn't split the text */}
              <span>
                Login as <b> {label}</b>
              </span>
            </a>
          </Button>
        ))}
      </LoginContainer>
      <SeedingContainer>
        <SectionDivider>
          <h3>Seed</h3>
        </SectionDivider>
        <Button
          variant="outline"
          className="mr-[15px]"
          onClick={() => API.seeds.delete()}
        >
          Delete Data
        </Button>
        <Button
          variant="outline"
          className="mr-[15px]"
          onClick={() => API.seeds.create()}
        >
          Seed Data
        </Button>
        <Button
          variant="outline"
          className="mr-[15px]"
          onClick={() => API.seeds.fillQueue()}
        >
          Add Questions to Queue
        </Button>
      </SeedingContainer>
    </Container>
  );
}

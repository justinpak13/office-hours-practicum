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

const SeedingContainer = styled.div`
  margin-left: auto;
  margin-right: auto;
  text-align: center;

  padding-top: 100px;
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

export default function DevPanel(): ReactElement {
  if (isProd()) {
    return <DefaultErrorPage statusCode={404} />;
  }
  return (
    <Container>
      <h1>
        <PageHeader>[ For Development Use Only ]</PageHeader>
      </h1>
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

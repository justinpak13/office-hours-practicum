import { Button } from "antd";
import { ReactElement } from "react";
import styled from "styled-components";

// oauth2-proxy's sign out ends here. The proxy lets this page through without
// a login, so it must not call the API.
const Container = styled.div`
  height: 80vh;
  display: flex;
  justify-content: center;
  align-items: center;
`;

const ContentContainer = styled.div`
  text-align: center;
`;

export default function SignedOut(): ReactElement {
  return (
    <Container>
      <ContentContainer>
        <h1>You have signed out</h1>
        <p>Sign in again to get back to your office hours.</p>
        <Button type="primary" href="/">
          Sign in
        </Button>
      </ContentContainer>
    </Container>
  );
}

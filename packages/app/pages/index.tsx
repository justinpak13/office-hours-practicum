import { User } from "@koh/common";
import Router from "next/router";
import { ReactElement } from "react";
import { useHomePageRedirect } from "../hooks/useHomePageRedirect";
import { useProfile } from "../hooks/useProfile";
import { Loader2 } from "lucide-react";

export default function Home(): ReactElement {
  const profile: User = useProfile();
  const didRedirect = useHomePageRedirect();
  if (profile && !didRedirect) {
    Router.push("/nocourses");
  } else {
    return (
      <div
        style={{
          position: "absolute",
          left: "50%",
          top: "50%",
          transform: "translate(-50%, -50%)",
        }}
      >
        {/* antd showed no text for a Spin without children; keep it for screen readers */}
        <div role="status">
          <Loader2 className="size-8 animate-spin text-primary" aria-hidden />
          <span className="sr-only">Loading...</span>
        </div>
      </div>
    );
  }

  return <div />;
}

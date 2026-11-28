/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/explicit-module-boundary-types */
import { ServerCrash } from "lucide-react";
import React, { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import * as Sentry from "@sentry/node";

interface EBState {
  hasError: boolean;
}
// eslint-disable-next-line @typescript-eslint/ban-types
export class ErrorBoundary extends React.Component<
  { children?: ReactNode },
  EBState
> {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error): EBState {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo): void {
    if (window) {
      Sentry.captureException(error);
    }
  }

  render(): ReactNode {
    if (this.state.hasError) {
      return (
        <div className="px-8 py-12 text-center">
          <ServerCrash
            className="mx-auto mb-6 size-16 text-muted-foreground"
            aria-hidden
          />
          <h2 className="m-0 text-2xl font-normal leading-[1.8] text-foreground">
            We hit an unexpected error.
          </h2>
          <p className="m-0 text-sm text-muted-foreground">
            Sorry about that! A report has automatically been filed. Try
            refreshing the page.
          </p>
          <div className="mt-6">
            <Button onClick={() => window.location.reload()}>
              Reload Page
            </Button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

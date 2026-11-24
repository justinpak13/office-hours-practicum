import { ReactElement } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type CantFindModalProps = {
  visible: boolean;
  leaveQueue: () => void;
  rejoinQueue: () => void;
};

export default function CantFindModal(props: CantFindModalProps): ReactElement {
  return (
    <Dialog open={props.visible}>
      {/* closable={false}: no close X, and Esc / outside clicks do nothing */}
      <DialogContent
        hideClose
        onEscapeKeyDown={(e) => e.preventDefault()}
        onInteractOutside={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle>You couldn&apos;t be found!</DialogTitle>
          <DialogDescription className="text-foreground">
            A TA tried to help you, but couldn&apos;t reach you. Are you still
            in the queue? If you are, make sure you have Teams open, and rejoin
            the queue.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button
            variant="destructive"
            data-cy="cant-find-leave"
            onClick={props.leaveQueue}
          >
            Leave Queue
          </Button>
          <Button data-cy="cant-find-rejoin" onClick={props.rejoinQueue}>
            Rejoin Queue
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

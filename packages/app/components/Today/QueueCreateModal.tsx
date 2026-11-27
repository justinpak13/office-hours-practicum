import { Role } from "@koh/common";
import { zodResolver } from "@hookform/resolvers/zod";
import { CircleHelp } from "lucide-react";
import { ReactElement, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

// Same rule and message as the antd form
const schema = z.object({
  isOnline: z.boolean(),
  allowTA: z.boolean(),
  officeHourName: z.string().min(1, "Please give this room a name."),
  notes: z.string(),
});
export type QueueCreateValues = z.infer<typeof schema>;

interface QueueCreateModalProps {
  visible: boolean;
  onSubmit: (values: QueueCreateValues) => void;
  onCancel: () => void;
  role: Role;
  lastName: string;
}

const ALLOW_TA_OPTIONS: { value: boolean; label: string; dataCy: string }[] = [
  {
    value: false,
    label: "Allow professors only",
    dataCy: "qc-allowTA-unchecked",
  },
  { value: true, label: "Allow TAs to check in", dataCy: "qc-allowTA-checked" },
];

export default function QueueCreateModal({
  visible,
  onSubmit,
  onCancel,
  role,
  lastName,
}: QueueCreateModalProps): ReactElement {
  const form = useForm<QueueCreateValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      isOnline: false,
      allowTA: true,
      officeHourName: "",
      notes: "",
    },
  });
  const isOnline = form.watch("isOnline");
  const allowTA = form.watch("allowTA");
  const nameError = form.formState.errors.officeHourName?.message;
  // Controlled so a tap opens it too; hover, focus and Escape still work
  const [tipOpen, setTipOpen] = useState(false);

  // Online queues get a fixed name: "Online", or the professor's own
  // professor-only queue
  const onlineName = (allowTAs: boolean) =>
    allowTAs ? `Online` : `Online - Professor ${lastName}'s Office Hours`;

  const onIsOnlineUpdate = (online: boolean) => {
    form.setValue("isOnline", online);
    form.setValue("officeHourName", online ? onlineName(allowTA) : "");
  };

  const onAllowTAUpdate = (allowTAs: boolean) => {
    form.setValue("allowTA", allowTAs);
    if (isOnline) {
      form.setValue("officeHourName", onlineName(allowTAs));
    }
  };

  return (
    <Dialog open={visible} onOpenChange={(open) => !open && onCancel()}>
      <DialogContent
        data-cy="queue-create-modal"
        // Start in Queue Location. By default the dialog focuses its first
        // button, the "?" next to Online?, which pops its tooltip open.
        onOpenAutoFocus={(e) => {
          e.preventDefault();
          document.getElementById("qc-location")?.focus();
        }}
        className="max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-[520px] overflow-y-auto rounded-lg"
      >
        <DialogHeader>
          <DialogTitle>Create a new queue</DialogTitle>
        </DialogHeader>
        {/* Create sits outside the form, so Enter doesn't submit (as before) */}
        <form className="space-y-6" onSubmit={(e) => e.preventDefault()}>
          <div className="space-y-2">
            <div className="flex items-center gap-1">
              <Label htmlFor="qc-isonline">
                <strong>Online?</strong>
              </Label>
              <Tooltip open={tipOpen} onOpenChange={setTipOpen}>
                <TooltipTrigger
                  type="button"
                  aria-label="Online? help"
                  className="cursor-pointer border-0 bg-transparent p-0 text-muted-foreground"
                  onClick={(e) => {
                    e.preventDefault();
                    setTipOpen(true);
                  }}
                >
                  <CircleHelp className="size-4" />
                </TooltipTrigger>
                <TooltipContent className="max-w-[250px]">
                  Online queues automatically open a Teams chat when helping a
                  student
                </TooltipContent>
              </Tooltip>
            </div>
            <Switch
              id="qc-isonline"
              data-cy="qc-isonline"
              checked={isOnline}
              onCheckedChange={onIsOnlineUpdate}
            />
          </div>

          {/* Professors only. For anyone else it's still in the page, hidden,
              as antd's hidden Form.Item was (Cypress: qc-allowTA exists but
              isn't visible). Real radio inputs, so Cypress can .check() them. */}
          <fieldset
            data-cy="qc-allowTA"
            hidden={role !== Role.PROFESSOR}
            className="m-0 space-y-2 border-0 p-0"
          >
            <legend className="mb-2 text-sm">
              <strong>Configure Queue Permissions</strong>
            </legend>
            <div className="flex flex-wrap gap-4">
              {ALLOW_TA_OPTIONS.map(({ value, label, dataCy }) => (
                <label
                  key={dataCy}
                  className="flex cursor-pointer items-center gap-2 text-sm"
                >
                  <input
                    type="radio"
                    name="allowTA"
                    value={String(value)}
                    data-cy={dataCy}
                    checked={allowTA === value}
                    onChange={() => onAllowTAUpdate(value)}
                    className="size-4 accent-primary"
                  />
                  {label}
                </label>
              ))}
            </div>
          </fieldset>

          <div className="space-y-2">
            <Label htmlFor="qc-location">
              <strong>Queue Location</strong>
            </Label>
            <Controller
              control={form.control}
              name="officeHourName"
              render={({ field }) => (
                <Input
                  id="qc-location"
                  data-cy="qc-location"
                  placeholder="Ex: ISEC 102"
                  // Online queues have a fixed name
                  disabled={isOnline}
                  aria-invalid={!!nameError}
                  className="w-full max-w-[350px]"
                  {...field}
                />
              )}
            />
            {/* role="alert" like antd's form errors (Cypress checks for it) */}
            {nameError && (
              <div role="alert" className="text-sm text-destructive">
                {nameError}
              </div>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="qc-notes">
              <strong>Additional Notes (optional)</strong>
            </Label>
            <Controller
              control={form.control}
              name="notes"
              render={({ field }) => (
                <Textarea
                  id="qc-notes"
                  data-cy="qc-notes"
                  rows={4}
                  placeholder="Notes"
                  {...field}
                />
              )}
            />
          </div>
        </form>
        <DialogFooter className="max-sm:gap-2">
          <Button variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button
            data-cy="queue-create-submit"
            onClick={form.handleSubmit((values) => onSubmit(values))}
          >
            Create
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

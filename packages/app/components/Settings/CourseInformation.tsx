import { API } from "@koh/api-client";
import { GetCourseResponse } from "@koh/common";
import { zodResolver } from "@hookform/resolvers/zod";
import { isEqual } from "lodash";
import { CircleHelp, CirclePlus, Trash2 } from "lucide-react";
import React, { ReactElement, useEffect, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { useCourse } from "../../hooks/useCourse";
import { Badge, badgeVariants } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

type CourseOverrideSettingsProps = { courseId: number };

// Without the base reset a bare <button> keeps the browser's grey box
const iconButton =
  "cursor-pointer border-0 bg-transparent p-0 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring";

// Same rules and messages as the old form
const schema = z.object({
  name: z.string().min(1, "Please input a display name."),
  coordinator_email: z
    .string()
    .min(1, "Please input your email.")
    .email("Please input your email."),
  icalURL: z
    .string()
    .regex(
      new RegExp("https://.*.ics"),
      "Please input your office hours calendar URL."
    ),
  crns: z.array(z.string()),
});
type CourseForm = z.infer<typeof schema>;

const padCRN = (c: number | string) => c.toString().padStart(5, "0");

// Values from the server can be null
const fromCourse = (course?: GetCourseResponse): CourseForm => ({
  name: course?.name ?? "",
  coordinator_email: course?.coordinator_email ?? "",
  icalURL: course?.icalURL ?? "",
  crns: (course?.crns ?? []).map(padCRN),
});

// A label with a "?" help tooltip next to it
function LabelWithTip({ label, tip }: { label: string; tip: string }) {
  // Controlled so a tap opens it too; hover, focus, Escape and outside taps still work
  const [open, setOpen] = useState(false);
  return (
    <div className="flex items-center gap-1">
      <FormLabel>{label}</FormLabel>
      <Tooltip open={open} onOpenChange={setOpen}>
        <TooltipTrigger
          type="button"
          aria-label={`${label} help`}
          className={cn(iconButton, "text-muted-foreground")}
          onClick={(e) => {
            e.preventDefault();
            setOpen(true);
          }}
        >
          <CircleHelp className="size-4" />
        </TooltipTrigger>
        <TooltipContent className="max-w-[250px]">{tip}</TooltipContent>
      </Tooltip>
    </div>
  );
}

export default function CourseInfo({
  courseId,
}: CourseOverrideSettingsProps): ReactElement {
  const { course, mutateCourse } = useCourse(courseId);
  const [showCRNInput, setShowCRNInput] = useState(false);
  const [inputCRN, setInputCRN] = useState("");
  // After Enter or a delete, focus goes to Add CRN instead of the page
  const addCRNRef = useRef<HTMLButtonElement>(null);
  const form = useForm<CourseForm>({
    resolver: zodResolver(schema),
    defaultValues: fromCourse(course),
  });

  // Fill the form when the course loads or changes, but never over unsaved edits
  const { isDirty } = form.formState;
  useEffect(() => {
    if (course && !isDirty) form.reset(fromCourse(course));
  }, [course, isDirty, form]);

  const crns = form.watch("crns");
  const setCrns = (next: string[]) =>
    form.setValue("crns", next, { shouldDirty: true });

  const handleDiscardChanges = () => form.reset(fromCourse(course));

  const onSubmit = async (formValues: CourseForm) => {
    const values = {
      ...formValues,
      crns: Array.from(new Set(formValues.crns)),
    };
    try {
      await API.course.editCourseInfo(courseId, {
        ...values,
        // NOTE: sent as zero-padded strings, as before; the server converts them
        crns: values.crns as unknown as number[],
      });
      const latest = form.getValues(); // read before the cache update can refill
      // Put the saved values in the cache first: the refill below then keeps
      // them even if the refetch is slow or fails
      await mutateCourse(
        { ...course, ...values, crns: values.crns.map(Number) },
        false
      );
      form.reset(values);
      // Put back anything changed while the save was in flight, still unsaved
      for (const k of Object.keys(values) as (keyof CourseForm)[])
        if (!isEqual(latest[k], values[k]))
          form.setValue(k, latest[k], { shouldDirty: true });
      mutateCourse();
      toast.success("Successfully updated course information.");
    } catch (e) {
      toast.error(
        e.response?.data?.message ??
          "Course information couldn't be saved. Please try again."
      );
    }
  };

  const handleCRNAdd = () => {
    if (inputCRN) {
      const crn = padCRN(inputCRN);
      if (crns.includes(crn)) {
        toast.error(`The CRN ${crn} already exists.`);
      } else {
        setCrns([...crns, crn]);
      }
    }
    setShowCRNInput(false);
    setInputCRN("");
  };

  if (!course) return null;

  return (
    <div>
      <Form {...form}>
        {/* Save sits outside the form, so Enter doesn't submit (as before) */}
        <form
          onSubmit={(e) => e.preventDefault()}
          className="mt-6 max-w-3xl space-y-6"
        >
          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem className="max-w-xs">
                <LabelWithTip
                  label="Course Display Name"
                  tip="This is the course name that will be displayed within the app"
                />
                <FormControl>
                  <Input placeholder="ex: CS 2500" maxLength={20} {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="coordinator_email"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Coordinator Email</FormLabel>
                <FormControl>
                  <Input placeholder="example@northeastern.edu" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="icalURL"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Office Hours Calendar URL</FormLabel>
                <FormControl>
                  <Input
                    placeholder="https://calendar.google.com/calendar/ical/.../basic.ics"
                    {...field}
                  />
                </FormControl>
                <FormDescription>
                  See{" "}
                  <a
                    className="underline"
                    target="_blank"
                    rel="noopener noreferrer"
                    href="https://sandboxnu.notion.site/Coordinator-s-Manual-f1e3bb50e50a4d84bfdb1275bfc559ff"
                  >
                    here
                  </a>{" "}
                  to create your office hours calendar
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
          <div className="space-y-2">
            <div className="text-sm font-medium">Registered CRNs</div>
            <div className="flex flex-wrap items-center gap-2">
              {crns.map((crn) => (
                <Badge
                  key={crn}
                  variant="secondary"
                  className="gap-1 px-2.5 py-1 text-[15px] font-normal"
                >
                  {crn}
                  <button
                    type="button"
                    aria-label={`Delete CRN ${crn}`}
                    className={iconButton}
                    onClick={() => {
                      setCrns(crns.filter((c) => c !== crn));
                      addCRNRef.current?.focus();
                    }}
                  >
                    <Trash2 className="size-[18px] text-[#F76C6C]" />
                  </button>
                </Badge>
              ))}
              {showCRNInput ? (
                <Input
                  type="text"
                  inputMode="numeric"
                  aria-label="New CRN"
                  className="w-24"
                  autoFocus
                  value={inputCRN}
                  onChange={(e) =>
                    // digits only, so the box never shows "-", "e" or "."
                    setInputCRN(e.target.value.replace(/\D/g, "").slice(0, 5))
                  }
                  onBlur={handleCRNAdd}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      flushSync(handleCRNAdd); // renders Add CRN now so it can take focus
                      addCRNRef.current?.focus();
                    }
                  }}
                />
              ) : (
                <button
                  type="button"
                  className={cn(
                    badgeVariants(),
                    "cursor-pointer gap-1 bg-[#408FEA] px-2.5 py-1 text-[15px] font-normal hover:bg-[#408FEA] focus:ring-0 focus:ring-offset-0 focus-visible:ring-2 focus-visible:ring-offset-2"
                  )}
                  ref={addCRNRef}
                  onClick={() => setShowCRNInput(true)}
                >
                  <CirclePlus className="size-[15px]" /> Add CRN
                </button>
              )}
            </div>
          </div>
        </form>
      </Form>

      <div className="mt-6 flex items-center gap-2">
        <Button variant="outline" onClick={handleDiscardChanges}>
          Discard Changes
        </Button>
        <Button
          onClick={form.handleSubmit(onSubmit)}
          disabled={form.formState.isSubmitting}
        >
          Save Changes
        </Button>
      </div>
    </div>
  );
}

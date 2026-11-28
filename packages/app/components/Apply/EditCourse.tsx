import React, { ReactElement, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { CircleHelp } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { createSGString, Highlight } from "./ApplyPage";

export interface EditCourseInfo {
  displayName: string;
  iCalURL: string;
  coordinator_email: string;
  timezone: string;
}

type EditCourseProps = {
  courseInfo: { name: string; crns: number[] } & Partial<EditCourseInfo>;
  onSubmitCourse: (courseInfo: EditCourseInfo) => any;
  onBack: () => any;
};

export const TimezoneCampusMapping = {
  "America/New_York": "East Coast US",
  "America/Los_Angeles": "West Coast US",
  "America/Toronto": "Toronto",
  "America/Vancouver": "Vancouver",
};

// Same rules as the antd form. Each field shows one message whether it is
// empty or invalid, like antd did. URLs need http(s) or ftp, like antd's check.
const emailMessage = "Please input your email.";
const urlMessage = "Please input your office hours calendar URL.";
const schema = z.object({
  displayName: z.string().min(1, "Please input a display name."),
  timezone: z
    .string()
    .min(1, "Please select a Northeastern campus (for purpose of timezone)."),
  coordinator_email: z
    .string()
    .min(1, emailMessage)
    .refine((v) => z.email().safeParse(v).success, emailMessage),
  iCalURL: z
    .string()
    .min(1, urlMessage)
    .refine(
      (v) => z.url({ protocol: /^(https?|ftp)$/ }).safeParse(v).success,
      urlMessage
    ),
});

const toFormValues = (c: Partial<EditCourseInfo>): EditCourseInfo => ({
  displayName: c.displayName ?? "",
  timezone: c.timezone ?? "",
  coordinator_email: c.coordinator_email ?? "",
  iCalURL: c.iCalURL ?? "",
});

// The "?" after a label, like antd's Form.Item tooltip
function LabelTip({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}): ReactElement {
  return (
    <Tooltip>
      <TooltipTrigger
        type="button"
        aria-label={label}
        className="ml-1 inline-flex cursor-help border-0 bg-transparent p-0 align-middle text-black/45"
      >
        <CircleHelp className="size-[14px]" />
      </TooltipTrigger>
      <TooltipContent className="max-w-[260px]">{children}</TooltipContent>
    </Tooltip>
  );
}

// antd's vertical form: label, 8px, a 32px white field, then a 24px row that
// holds the error, so a row is the same height with or without one. Labels
// stay dark and the field border turns red, like antd.
const itemClass = "space-y-0";
const labelClass = "font-normal leading-[22px] text-black/85";
const fieldClass =
  "h-8 rounded-[2px] border-[#d9d9d9] bg-white shadow-none hover:border-[#40a9ff] aria-[invalid=true]:border-[#ff4d4f]";
const messageClass = "text-sm font-normal leading-6 text-[#ff4d4f]";

function Required(): ReactElement {
  return (
    <span aria-hidden="true" className="mr-1 text-[#ff4d4f]">
      *
    </span>
  );
}

export default function EditCourse({
  courseInfo,
  onSubmitCourse,
  onBack,
}: EditCourseProps): ReactElement {
  const form = useForm<EditCourseInfo>({
    resolver: zodResolver(schema),
    defaultValues: toFormValues(courseInfo),
  });
  const sectionGroupString = createSGString(courseInfo);

  // A new course (or coming back to one) starts from its saved values
  useEffect(() => {
    form.reset(toFormValues(courseInfo));
  }, [courseInfo, form]);

  return (
    <div>
      <h3 style={{ marginBottom: "1.5em" }}>
        Please fill out the following course information for{" "}
        <Highlight>{sectionGroupString}</Highlight>
      </h3>

      <Form {...form}>
        {/* Enter doesn't submit, like the antd form (it had no submit button) */}
        <form onSubmit={(e) => e.preventDefault()}>
          <FormField
            control={form.control}
            name="displayName"
            render={({ field }) => (
              <FormItem className={itemClass}>
                <div className="flex items-center pb-2">
                  <FormLabel className={labelClass}>
                    <Required />
                    Course Display Name
                  </FormLabel>
                  <LabelTip label="About Course Display Name">
                    This is the course name that will be displayed within the
                    app
                  </LabelTip>
                </div>
                <FormControl>
                  <Input
                    className={fieldClass}
                    placeholder="ex: CS 2500"
                    maxLength={20}
                    {...field}
                  />
                </FormControl>
                <div className="min-h-6">
                  <FormMessage className={messageClass} />
                </div>
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="timezone"
            render={({ field }) => (
              <FormItem className={itemClass}>
                <FormLabel className={labelClass + " block pb-2"}>
                  <Required />
                  Campus
                </FormLabel>
                <Select value={field.value} onValueChange={field.onChange}>
                  <FormControl>
                    <SelectTrigger
                      ref={field.ref}
                      onBlur={field.onBlur}
                      className={fieldClass}
                    >
                      <SelectValue />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {Object.entries(TimezoneCampusMapping).map(
                      ([timezone, campus]) => (
                        <SelectItem value={timezone} key={timezone}>
                          {campus}
                        </SelectItem>
                      )
                    )}
                  </SelectContent>
                </Select>
                <div className="min-h-6">
                  <FormMessage className={messageClass} />
                </div>
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="coordinator_email"
            render={({ field }) => (
              <FormItem className={itemClass}>
                <div className="flex items-center pb-2">
                  <FormLabel className={labelClass}>
                    <Required />
                    Course Contact Email
                  </FormLabel>
                  <LabelTip label="About Course Contact Email">
                    This can be your email or that of a course
                    coordinator&apos;s
                  </LabelTip>
                </div>
                <FormControl>
                  <Input
                    className={fieldClass}
                    placeholder="example@northeastern.edu"
                    {...field}
                  />
                </FormControl>
                <div className="min-h-6">
                  <FormMessage className={messageClass} />
                </div>
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="iCalURL"
            render={({ field }) => (
              <FormItem className={itemClass}>
                <div className="flex items-center pb-2">
                  <FormLabel className={labelClass}>
                    <Required />
                    Office Hours Calendar URL
                  </FormLabel>
                  <LabelTip label="About Office Hours Calendar URL">
                    See{" "}
                    <a
                      target="_blank"
                      rel="noreferrer"
                      className="underline"
                      href="https://sandboxnu.notion.site/Coordinator-s-Manual-f1e3bb50e50a4d84bfdb1275bfc559ff"
                    >
                      here
                    </a>{" "}
                    to create your office hours calendar
                  </LabelTip>
                </div>
                <FormControl>
                  <Input
                    className={fieldClass}
                    placeholder="https://calendar.google.com/calendar/ical/.../basic.ics"
                    {...field}
                  />
                </FormControl>
                <div className="min-h-6">
                  <FormMessage className={messageClass} />
                </div>
              </FormItem>
            )}
          />
        </form>
      </Form>
      <div className="flex gap-2">
        <Button variant="outline" onClick={onBack}>
          Back
        </Button>
        <Button onClick={form.handleSubmit((values) => onSubmitCourse(values))}>
          Next
        </Button>
      </div>
    </div>
  );
}

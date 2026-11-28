import React, { ReactElement, useState } from "react";
import styled from "styled-components";
import { ChevronDown, CircleCheck, Info, TriangleAlert, X } from "lucide-react";
import { useProfile } from "../../hooks/useProfile";
import { KhouryProfCourse } from "@koh/common";
import { useEffect } from "react";
import { createSGString } from "./ApplyPage";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

const Italics = styled.span`
  font-weight: normal;
  font-size: 16px;
  font-style: italic;
`;

const FormSection = styled.div`
  margin-top: 20px;
`;

const CoursesBlock = styled.div`
  background-color: #fff;
  border: 1px solid #d9d9d9;
  border-radius: 2px;
  padding: 5px;
  display: flex;
  align-items: center;
`;

// antd's Alert colours (warning, info, success)
const notices = [
  {
    title: "Notice",
    text: "The Admin Portal will start sending data 1 week before the start of the semester. Once it does, this form can be filled out.",
    Icon: TriangleAlert,
    className: "border-[#ffe58f] bg-[#fffbe6] [&>svg]:text-[#faad14]",
  },
  {
    title: "Course list may be out of date",
    text: "This list reflects the courses assigned to you at your last login. If you are missing a course, please log out and log back in to refresh your course data.",
    Icon: Info,
    className: "border-[#91d5ff] bg-[#e6f7ff] [&>svg]:text-[#1890ff]",
  },
  {
    title: "New as of Summer 2026",
    text: "You can now register additional courses at any time during the semester. Use the Register More Courses button on your profile settings page to return here.",
    Icon: CircleCheck,
    className: "border-[#b7eb8f] bg-[#f6ffed] [&>svg]:text-[#52c41a]",
  },
];

// Search the course label, any case
const labelContains = (
  _value: string,
  search: string,
  keywords?: string[]
): number =>
  (keywords ?? []).join(" ").toLowerCase().includes(search.toLowerCase())
    ? 1
    : 0;

export default function SelectCourses({
  onSubmit,
  initialValues,
}: {
  onSubmit: (courses: KhouryProfCourse[]) => any;
  initialValues: string[];
}): ReactElement {
  const [selectedCourses, setSelectedCourses] = useState<number[]>([]);
  const [pickerOpen, setPickerOpen] = useState(false);
  const profile = useProfile();

  // populate initially selected courses when returning to first selection page
  useEffect(() => {
    const defaultValues = profile?.pendingCourses?.reduce(
      (defaults: number[], course, idx) => {
        if (initialValues.find((name) => name === course.name)) {
          defaults.push(idx);
          return defaults;
        } else return defaults;
      },
      []
    );
    setSelectedCourses(defaultValues || []);
  }, []);

  // Values are list indexes; Command needs strings, so they go in as String(idx)
  const toggleCourse = (value: string) => {
    const idx = Number(value);
    setSelectedCourses((prev) =>
      prev.includes(idx) ? prev.filter((i) => i !== idx) : [...prev, idx]
    );
  };
  const handleSubmit = () =>
    onSubmit(
      selectedCourses.map((courseIdx) => profile?.pendingCourses[courseIdx])
    );

  const pending = profile?.pendingCourses ?? [];

  return (
    <div>
      {notices.map(({ title, text, Icon, className }) => (
        <Alert
          key={title}
          className={cn("mb-4 rounded-[2px] px-6 py-4", className)}
        >
          <Icon className="!left-6 !top-4 size-6" />
          <AlertTitle className="mb-1 pl-9 text-base font-normal leading-6 text-black/85">
            {title}
          </AlertTitle>
          <AlertDescription className="pl-9 text-sm leading-[22px] text-black/85">
            {text}
          </AlertDescription>
        </Alert>
      ))}
      <div>
        Please select the courses you want to use Khoury Office Hours for.
        Courses already registered for the app are shown below.
      </div>

      <FormSection>
        <h3 id="select-courses-label">
          Courses{" "}
          <Italics>(Select all the courses you are applying for)</Italics>
        </h3>

        <Popover open={pickerOpen} onOpenChange={setPickerOpen}>
          <PopoverTrigger asChild>
            <div
              role="combobox"
              tabIndex={0}
              aria-expanded={pickerOpen}
              aria-labelledby="select-courses-label"
              onKeyDown={(e) => {
                if (e.target !== e.currentTarget) return;
                if (
                  e.key === "Enter" ||
                  e.key === " " ||
                  e.key === "ArrowDown"
                ) {
                  e.preventDefault();
                  setPickerOpen(true);
                }
              }}
              className="flex min-h-8 w-full cursor-pointer flex-wrap items-center gap-1 rounded-[2px] border border-[#d9d9d9] bg-white py-[3px] pl-1 pr-8 text-sm relative hover:border-[#40a9ff] focus-visible:border-[#40a9ff] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1890ff]/20"
            >
              {selectedCourses.length === 0 && (
                <span className="px-2 text-[#bfbfbf]">
                  Please select your courses
                </span>
              )}
              {selectedCourses.map((idx) =>
                pending[idx] ? (
                  <span
                    key={pending[idx].name}
                    className="inline-flex h-6 max-w-full items-center gap-1 rounded-[2px] border border-[#f0f0f0] bg-[#f5f5f5] pl-2 pr-1"
                  >
                    <span className="truncate">
                      {createSGString(pending[idx])}
                    </span>
                    <button
                      type="button"
                      aria-label={`Remove ${pending[idx].name}`}
                      className="inline-flex border-0 bg-transparent p-0 text-black/45 hover:text-black/75"
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleCourse(String(idx));
                      }}
                    >
                      <X className="size-3" />
                    </button>
                  </span>
                ) : null
              )}
              <ChevronDown className="absolute right-[11px] size-3 text-black/25" />
            </div>
          </PopoverTrigger>
          <PopoverContent
            className="w-[var(--radix-popover-trigger-width)] p-0"
            align="start"
          >
            <Command filter={labelContains}>
              <CommandInput placeholder="Search courses..." />
              <CommandList>
                <CommandEmpty>No courses found.</CommandEmpty>
                <CommandGroup>
                  {pending.map((course, idx) => {
                    const checked = selectedCourses.includes(idx);
                    return (
                      <CommandItem
                        key={course.name}
                        value={String(idx)}
                        keywords={[createSGString(course)]}
                        // the list stays open so several courses can be picked
                        onSelect={toggleCourse}
                        // keep typing in the search box after a click, like antd
                        onMouseDown={(e) => e.preventDefault()}
                        aria-selected={checked}
                      >
                        <Checkbox
                          checked={checked}
                          tabIndex={-1}
                          aria-hidden="true"
                          className="pointer-events-none"
                        />
                        {createSGString(course)}
                      </CommandItem>
                    );
                  })}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
      </FormSection>

      <FormSection>
        <h3>The following courses have already registered for the app:</h3>
        <CoursesBlock>
          {profile?.courses.map((course) => (
            <Badge
              key={course.course?.id}
              variant="outline"
              className="mr-2 rounded-[2px] border-[#d9d9d9] bg-[#fafafa] px-[6px] py-[2px] text-sm font-normal leading-5 text-black/85"
            >
              {course.course?.name}
            </Badge>
          ))}
        </CoursesBlock>
      </FormSection>

      <Button onClick={handleSubmit} style={{ marginTop: "30px" }}>
        Next
      </Button>
    </div>
  );
}

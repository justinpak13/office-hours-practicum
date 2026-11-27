import React, { ReactElement, useState } from "react";

import { API } from "@koh/api-client";
import useSWR from "swr";
import { format } from "date-fns";
import { CalendarIcon, CircleHelp, Info, Loader2 } from "lucide-react";
import { DateRange } from "react-day-picker";
import { useProfile } from "../../../hooks/useProfile";
import {
  BarChartOutputType,
  DateRangeType,
  InsightComponent,
  InsightDisplayInfo,
  SimpleDisplayOutputType,
  SimpleTableOutputType,
} from "@koh/common";

import BarChartComponent from "../../../components/Insights/components/BarChartComponent";
import SimpleDisplayComponent from "../../../components/Insights/components/SimpleDisplayComponent";
import InsightsDisplayOptions from "../../../components/Insights/components/InsightsDisplayOptions";
import { SimpleTable } from "../../../components/Insights/components/SimpleTable";
import NavBar from "../../../components/Nav/NavBar";
import { StandardPageContainer } from "../../../components/common/PageContainer";
import { useRouter } from "next/router";
import styled from "styled-components";
import { SetStateAction } from "react";
import { Dispatch } from "react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Separator } from "@/components/ui/separator";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

// antd RangePicker's value format, which the insights API receives
const API_DATE = "yyyy-MM-dd";

// A "?" or "i" icon with a tooltip, reachable by keyboard
function HelpTip({
  label,
  text,
  children,
}: {
  label: string;
  text: string;
  children: React.ReactNode;
}) {
  return (
    <Tooltip>
      <TooltipTrigger
        type="button"
        aria-label={label}
        className="inline-flex cursor-pointer border-0 bg-transparent p-0 text-inherit"
      >
        {children}
      </TooltipTrigger>
      <TooltipContent className="max-w-[260px]">{text}</TooltipContent>
    </Tooltip>
  );
}

const InsightsRowContainer = styled.div`
  display: flex;
  direction: ltr;
  margin-left: -0.5%;
  margin-right: -0.5%;
`;

export default function Insights(): ReactElement {
  const profile = useProfile();
  const router = useRouter();
  const { cid } = router.query;

  const [dateRange, setDateRange] = useState({ start: "", end: "" });
  // Like antd's RangePicker: the first click picks the start, the second the
  // end (either order), and only then does dateRange change. The calendar's own
  // range mode would report a one-day range on the first click, so the clicks
  // are tracked here.
  const [appliedRange, setAppliedRange] = useState<DateRange | undefined>();
  const [rangeStart, setRangeStart] = useState<Date | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const shownRange: DateRange | undefined = rangeStart
    ? { from: rangeStart, to: undefined }
    : appliedRange;
  const [mostActiveStudentsPage, setMostActiveStudentsPage] = useState(1);

  const { data: allInsights } = useSWR(`api/v1/insights/listAll`, async () =>
    API.insights.list()
  );
  const [settingsVisible, setSettingsVisible] = useState(false);

  if (!allInsights || !profile?.insights) {
    return null;
  }
  // Group users insights by size (small | default) so they can be rendered correctly
  const [smallInsights, defaultInsights] = profile.insights.reduce(
    ([smallInsights, defaultInsights], insight) =>
      allInsights[insight].size === "small"
        ? [[...smallInsights, insight], defaultInsights]
        : [smallInsights, [...defaultInsights, insight]],
    [[], []]
  );

  const onDayClick = (day: Date) => {
    if (!rangeStart) {
      setRangeStart(day);
      return;
    }
    const [from, to] =
      rangeStart <= day ? [rangeStart, day] : [day, rangeStart];
    setRangeStart(null);
    setAppliedRange({ from, to });
    setDateRange({ start: format(from, API_DATE), end: format(to, API_DATE) });
    setPickerOpen(false);
  };
  const clearRange = () => {
    setRangeStart(null);
    setAppliedRange(undefined);
    setDateRange({ start: "", end: "" });
    setPickerOpen(false);
  };
  // Closing halfway through keeps the previous range, as antd does
  const onPickerOpenChange = (open: boolean) => {
    setPickerOpen(open);
    if (!open) setRangeStart(null);
  };

  return (
    <>
      <StandardPageContainer>
        <NavBar courseId={Number(cid)} />
        <div className="my-3 flex flex-wrap items-center justify-between gap-3">
          <h1 style={{ display: "inline", margin: "0px" }}>
            Insights Dashboard
          </h1>
          <div className="flex flex-wrap items-center">
            <div className="flex items-center">
              <HelpTip
                label="About the date range"
                text="If no date range is selected results are from the data for the full semester so far"
              >
                <CircleHelp className="size-[14px]" />
              </HelpTip>
              <b
                style={{
                  display: "inline-block",
                  marginRight: "12px",
                  marginLeft: "8px",
                }}
              >
                Date Range
              </b>
              <Popover open={pickerOpen} onOpenChange={onPickerOpenChange}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className="w-[260px] justify-start font-normal"
                  >
                    <CalendarIcon />
                    {dateRange.start ? (
                      `${dateRange.start} → ${dateRange.end}`
                    ) : (
                      <span className="text-muted-foreground">
                        Start date → End date
                      </span>
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="end">
                  <Calendar
                    mode="range"
                    numberOfMonths={2}
                    selected={shownRange}
                    onSelect={(_range, day) => onDayClick(day)}
                    defaultMonth={appliedRange?.from}
                  />
                  {(rangeStart || dateRange.start) && (
                    <div className="flex justify-end border-t p-2">
                      <Button variant="ghost" size="sm" onClick={clearRange}>
                        Clear
                      </Button>
                    </div>
                  )}
                </PopoverContent>
              </Popover>
            </div>
            <Button
              variant="outline"
              className="ml-6"
              onClick={() => setSettingsVisible(true)}
            >
              Edit Insights
            </Button>
          </div>
        </div>
        <Separator className="mb-4" />
        {/* was antd's left Drawer (400px, emptied when closed) */}
        <Sheet open={settingsVisible} onOpenChange={setSettingsVisible}>
          <SheetContent
            side="left"
            className="w-[400px] max-w-full overflow-y-auto sm:max-w-[400px]"
          >
            <SheetHeader className="mb-6">
              <SheetTitle>Display Options</SheetTitle>
            </SheetHeader>
            <InsightsDisplayOptions />
          </SheetContent>
        </Sheet>
        <InsightsRowContainer>
          {smallInsights?.map((insightName: string) => {
            return (
              <MemoizedRenderInsight
                key={insightName}
                insightName={insightName}
                insightDisplay={allInsights[insightName]}
                dateRange={dateRange}
                mostActiveStudentsPage={mostActiveStudentsPage}
                setMostActiveStudentsPage={setMostActiveStudentsPage}
              />
            );
          })}
        </InsightsRowContainer>
        <InsightsRowContainer>
          {defaultInsights?.map((insightName: string) => {
            return (
              <MemoizedRenderInsight
                key={insightName}
                insightName={insightName}
                insightDisplay={allInsights[insightName]}
                dateRange={dateRange}
                mostActiveStudentsPage={mostActiveStudentsPage}
                setMostActiveStudentsPage={setMostActiveStudentsPage}
              />
            );
          })}
        </InsightsRowContainer>
      </StandardPageContainer>
    </>
  );
}

interface RenderInsightProps {
  insightName: string;
  insightDisplay: InsightDisplayInfo;
  dateRange: DateRangeType;
  mostActiveStudentsPage: number;
  setMostActiveStudentsPage: Dispatch<SetStateAction<number>>;
}

const equalRenderInsights = (
  prevProps: RenderInsightProps,
  nextProps: RenderInsightProps
): boolean => {
  if (
    prevProps.insightName === "MostActiveStudents" &&
    nextProps.insightName === "MostActiveStudents"
  ) {
    return (
      prevProps.mostActiveStudentsPage === nextProps.mostActiveStudentsPage &&
      prevProps.dateRange.start === nextProps.dateRange.start &&
      prevProps.dateRange.end === nextProps.dateRange.end
    );
  } else {
    return (
      prevProps.insightName === nextProps.insightName &&
      prevProps.dateRange.start === nextProps.dateRange.start &&
      prevProps.dateRange.end === nextProps.dateRange.end
    );
  }
};
const MemoizedRenderInsight = React.memo(RenderInsight, equalRenderInsights);

function RenderInsight({
  insightName,
  insightDisplay,
  dateRange,
  mostActiveStudentsPage,
  setMostActiveStudentsPage,
}: RenderInsightProps): ReactElement {
  const router = useRouter();
  const { cid } = router.query;

  const limit = insightName === "MostActiveStudents" ? 6 : null;
  const offset =
    insightName === "MostActiveStudents"
      ? (mostActiveStudentsPage - 1) * limit
      : null;
  const { data: insightOutput } = useSWR(
    cid &&
      `api/v1/insights/${cid}/${insightName}?start=${dateRange.start}&end=${
        dateRange.end
      }${limit ? "limit&6" : ""}${offset ? `offset&${offset}` : ""}`,
    async () =>
      await API.insights.get(Number(cid), insightName, {
        start: dateRange.start,
        end: dateRange.end,
        limit,
        offset,
      })
  );

  let insightComponent;
  if (insightOutput === undefined) {
    insightComponent = (
      <div role="status" aria-label="Loading" style={{ margin: "10% 45%" }}>
        <Loader2 className="size-5 animate-spin text-primary" />
      </div>
    );
  } else {
    switch (insightDisplay.component) {
      case InsightComponent.SimpleDisplay:
        insightComponent = (
          <SimpleDisplayComponent
            key={insightName}
            output={insightOutput as SimpleDisplayOutputType}
          />
        );
        break;
      case InsightComponent.BarChart:
        insightComponent = (
          <BarChartComponent
            key={insightName}
            output={insightOutput as BarChartOutputType}
          />
        );
        break;
      case InsightComponent.SimpleTable:
        insightComponent = (
          <SimpleTable
            key={insightName}
            output={insightOutput as SimpleTableOutputType}
            currentPage={mostActiveStudentsPage}
            setPage={setMostActiveStudentsPage}
          />
        );
        break;
      default:
        // Line below will show error if switch is not exhaustive of all enum values
        componentDoesNotExist(insightDisplay.component);
    }
  }

  // Styled like antd's Card: "small" has a 38px header and 12px padding,
  // "default" a 48px header and 24px padding
  const small = insightDisplay.size === "small";
  return (
    <Card
      className="rounded-sm border-[#f0f0f0] shadow-none"
      style={{
        margin: "0.5%",
        padding: "2px",
        width: insightDisplay.size === "default" ? "50%" : "16.66%",
        maxWidth: insightDisplay.size === "default" ? "625px" : "200px",
      }}
    >
      <CardHeader
        className={cn(
          "flex-row items-center justify-between gap-1 space-y-0 border-b border-[#f0f0f0] py-0",
          small ? "min-h-[38px] px-3" : "min-h-[48px] px-6"
        )}
      >
        <CardTitle
          className={cn(
            "font-medium leading-snug tracking-normal text-[rgba(0,0,0,0.85)]",
            small ? "text-sm" : "text-base"
          )}
        >
          {insightDisplay.displayName}
        </CardTitle>
        <HelpTip
          label={`About ${insightDisplay.displayName}`}
          text={insightDisplay.description}
        >
          <Info className="size-[14px] shrink-0" />
        </HelpTip>
      </CardHeader>
      <CardContent className={cn("relative", small ? "p-3" : "p-6")}>
        {insightComponent}
      </CardContent>
    </Card>
  );
}

function componentDoesNotExist(componentName: never): never {
  throw new Error(`Component ${componentName} was unable to be rendered`);
}

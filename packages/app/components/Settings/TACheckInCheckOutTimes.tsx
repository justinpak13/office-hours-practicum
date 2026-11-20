import { API } from "@koh/api-client";
import { Info } from "lucide-react";
import moment from "moment";
import React, { ReactElement, useRef, useState } from "react";
import {
  Calendar,
  CalendarProps,
  Event,
  momentLocalizer,
} from "react-big-calendar";
import styled from "styled-components";
import useSWR from "swr";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";

const TACheckInCheckOutCalendar = styled(Calendar)<CalendarProps>`
  height: 70vh;
  padding-top: 36px;
  padding-left: 36px;
`;

const CheckinHeader = styled.h1`
  margin-top: 12px;
  margin-bottom: 0;
  padding-left: 36px;
`;

interface TACheckInCheckOutTimesProps {
  courseId: number;
}

export default function TACheckInCheckOutTimes({
  courseId,
}: TACheckInCheckOutTimesProps): ReactElement {
  // there has to be a better way -- right?
  const sunday = new Date();
  sunday.setDate(sunday.getDate() - sunday.getDay());
  sunday.setHours(0, 0, 0, 0);
  const nextSunday = new Date();
  nextSunday.setDate(sunday.getDate() + 7);
  nextSunday.setHours(0, 0, 0, 0);

  const [startDate, setStartDate] = useState(sunday);
  const [endDate, setEndDate] = useState(nextSunday);
  // The clicked event; kept while the dialog closes so its text doesn't blank
  const [selectedEvent, setSelectedEvent] = useState<Event>();
  const [infoOpen, setInfoOpen] = useState(false);
  // The dialog has no trigger or Cancel button, so Radix can't place focus by
  // itself: focus OK on open and give focus back to the clicked event on close
  const eventElement = useRef<HTMLElement>(null);
  const okButton = useRef<HTMLButtonElement>(null);

  // SWR 2 passes an array key to the fetcher as a single argument.
  const fetcher = ([, startDate, endDate]: [string, Date, Date]) => {
    return API.course.getTACheckinTimes(
      courseId,
      startDate.toISOString(),
      endDate.toISOString()
    );
  };

  const { data, mutate } = useSWR(
    [`/api/v1/course/getTACheckinCheckoutTimes`, startDate, endDate],
    fetcher
  );

  const tasWhoForgotToCheckOut = data?.taCheckinTimes.filter((e) => e.forced);
  const tasWhoAreCurrentlyInOH = data?.taCheckinTimes.filter(
    (e) => e.inProgress
  );

  const calData: Event[] =
    data?.taCheckinTimes.map((e) => ({
      start: e.checkinTime,
      end: e.checkoutTime ? e.checkoutTime : new Date(),
      title: e.inProgress
        ? `TA currently holding office hours: ${e.name}`
        : e.forced
        ? `TA forgot to check out: ${e.name}`
        : e.name,
      resource: e.numHelped,
    })) ?? [];

  // Could have so many cool metrics, like, click on a ta's name and a modal
  // comes up with the metrics of who they helped
  // sinc eit's  acallback, maybe have to make a div that a modal can then
  // portal a modal onto it
  // https://reactjs.org/docs/react-dom.html#createportal

  const exportData = () => {
    const rows = data?.taCheckinTimes ?? [];
    const headers = [
      "Name",
      "Check-In Time",
      "Check-Out Time",
      "Students Helped",
      "Forced Checkout",
      "In Progress",
    ];
    const csvRows = [
      headers.join(","),
      ...rows.map((e) =>
        [
          `"${e.name}"`,
          `"${e.checkinTime ? new Date(e.checkinTime).toLocaleString() : ""}"`,
          `"${
            e.checkoutTime ? new Date(e.checkoutTime).toLocaleString() : ""
          }"`,
          e.numHelped ?? 0,
          e.forced ? "Yes" : "No",
          e.inProgress ? "Yes" : "No",
        ].join(",")
      ),
    ].join("\n");
    const csvString = `data:text/csv;charset=utf-8,${encodeURIComponent(
      csvRows
    )}`;
    const link = document.createElement("a");
    link.href = csvString;
    link.download = "checkinCheckoutEventData.csv";
    link.click();
  };

  return (
    <div>
      <CheckinHeader>TA Check-In Check-Out Times</CheckinHeader>
      <TACheckInCheckOutCalendar
        events={calData}
        localizer={momentLocalizer(moment)}
        showMultiDayTimes={true}
        defaultView={"week"}
        onRangeChange={(newDates) => {
          if (Array.isArray(newDates)) {
            setStartDate(newDates[0]);
            setEndDate(newDates[newDates.length - 1]);
          } else {
            setStartDate(new Date(newDates.start));
            setEndDate(new Date(newDates.end));
          }
          mutate();
        }}
        onSelectEvent={(event, e) => {
          eventElement.current = e.currentTarget as HTMLElement;
          setSelectedEvent(event);
          setInfoOpen(true);
        }}
      />
      <AlertDialog open={infoOpen} onOpenChange={setInfoOpen}>
        <AlertDialogContent
          onOpenAutoFocus={(e) => {
            e.preventDefault();
            okButton.current?.focus();
          }}
          onCloseAutoFocus={(e) => {
            e.preventDefault();
            eventElement.current?.focus();
          }}
        >
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Info
                aria-hidden="true"
                className="size-5 shrink-0 text-primary"
              />
              {selectedEvent?.title as string}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {`Helped ${selectedEvent?.resource} students during this session`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction ref={okButton}>OK</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <Button
        onClick={exportData}
        className="ml-9 cursor-pointer [font-family:inherit]"
      >
        Download check-in/checkout data
      </Button>
      {tasWhoAreCurrentlyInOH?.length ? (
        <div>
          <h3>People currently holding office hours:</h3>
          {tasWhoAreCurrentlyInOH.map((ta) => (
            <p key={ta.name}>{ta.name}</p>
          ))}
        </div>
      ) : null}
      {tasWhoForgotToCheckOut?.length ? (
        <div>
          <h3 style={{ color: "red" }}>
            The following course staff forgot to check out:
          </h3>
          {tasWhoForgotToCheckOut.map((ta) => (
            <p key={ta.name}>{ta.name}</p>
          ))}
          <p style={{ width: "800px" }}>
            Please remind course staff to check out at the end of their office
            hours. This way students don&apos;t join a queue thinking that there
            are still office hours when the course staff has already left
          </p>
        </div>
      ) : null}
    </div>
  );
}

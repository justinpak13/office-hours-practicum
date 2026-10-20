import { ReactElement, useState, useEffect, useRef } from "react";
import FullCalendar from "@fullcalendar/react"; // must go before plugins
import { EventContentArg, EventInput } from "@fullcalendar/core";
import timeGridPlugin from "@fullcalendar/timegrid";
import listPlugin from "@fullcalendar/list";
import dayGridPlugin from "@fullcalendar/daygrid";
import * as ICAL from "ical.js";
import { Button, Spin, Tooltip } from "antd";
import { useRoleInCourse } from "../../hooks/useRoleInCourse";
import { Role } from "@koh/common";
import styled from "styled-components";

const CalendarWrapper = styled.div`
  margin-bottom: 20px;
`;
const TimezoneNote = styled.div`
  margin-bottom: 8px;
  color: #8c8c8c;
  font-size: 14px;
`;
const UpdateButton = styled(Button)`
  border-radius: 6px;
  color: white;
  font-weight: 500;
  font-size: 14px;
`;
const SpinnerContainer = styled.div`
  position: absolute;
  top: 0;
  left: 0;
  height: 100%;
  width: 100%;
  background: #f8f9fb99;
  z-index: 100;
  display: flex;
  justify-content: center;
  align-items: center;
`;

type ScheduleProps = {
  courseId: number;
  defaultView?: "dayGridMonth" | "timeGridWeek" | "timeGridDay" | "listWeek";
};

export default function SchedulePanel({
  courseId,
  defaultView = "timeGridWeek",
}: ScheduleProps): ReactElement {
  // The calendar reads the browser's XMLHttpRequest/fetch, which isn't available
  // during Next.js server-side render. Only render it after the component mounts.
  const [isClientSide, setIsClientSide] = useState(false);
  const role = useRoleInCourse(courseId);
  const calendarRef = useRef(null);
  const spinnerRef = useRef(null);

  useEffect(() => {
    // it is now safe to render the client-side only component
    setIsClientSide(true);
  }, []);

  // allows us to render tooltips around events (in case of cluttered calendars)
  const renderEventContent = (arg: EventContentArg) => {
    // Only the week and day time-grid views get tooltips.
    if (arg.view.type.startsWith("timeGrid")) {
      return (
        <Tooltip title={`${arg.timeText}: ${arg.event.title}`}>
          <span>
            <strong>{arg.timeText}</strong> {arg.event.title}
          </span>
        </Tooltip>
      );
    }
  };

  // Events are authored in the course's timezone (e.g. America/New_York). We
  // convert each occurrence to an absolute instant with ical.js and hand
  // FullCalendar real Date objects, which it then renders in the viewer's local
  // timezone. (The built-in @fullcalendar/icalendar source emits naive
  // wall-clock strings that don't convert, so we expand the feed ourselves.)
  const localTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const timezoneAbbr = new Date()
    .toLocaleTimeString("en-US", { timeZoneName: "short" })
    .split(" ")
    .pop();

  const fetchCalUrl = (refresh: boolean) =>
    `/api/v1/resources/calendar/${courseId}/refresh=${refresh}`;

  // FullCalendar event source: fetch the ICS, register its VTIMEZONE(s) so
  // ical.js can resolve TZID times, expand recurrences within the visible
  // range, and return absolute-instant events.
  const loadEvents = (
    fetchInfo: { start: Date; end: Date },
    successCallback: (events: EventInput[]) => void,
    failureCallback: (error: Error) => void
  ): void => {
    (async () => {
      try {
        const res = await fetch(fetchCalUrl(false));
        if (!res.ok) {
          throw new Error(`Calendar request failed: ${res.status}`);
        }
        const text = await res.text();
        const component = new ICAL.Component(ICAL.parse(text));
        component.getAllSubcomponents("vtimezone").forEach((vtimezone) => {
          try {
            ICAL.TimezoneService.register(vtimezone);
          } catch (e) {
            // ignore an individual malformed VTIMEZONE
          }
        });

        const rangeStart = fetchInfo.start;
        const rangeEnd = fetchInfo.end;
        const events: EventInput[] = [];

        for (const vevent of component.getAllSubcomponents("vevent")) {
          const event = new ICAL.Event(vevent);
          if (event.isRecurrenceException()) {
            continue;
          }
          if (event.isRecurring()) {
            const iterator = event.iterator();
            let next;
            let guard = 0;
            while ((next = iterator.next()) && guard++ < 2000) {
              const occurrenceStart = next.toJSDate();
              if (occurrenceStart > rangeEnd) {
                break;
              }
              if (occurrenceStart < rangeStart) {
                continue;
              }
              const details = event.getOccurrenceDetails(next);
              events.push({
                title: event.summary,
                start: details.startDate.toJSDate(),
                end: details.endDate.toJSDate(),
                allDay: details.startDate.isDate,
              });
            }
          } else {
            const start = event.startDate.toJSDate();
            if (start >= rangeStart && start <= rangeEnd) {
              events.push({
                title: event.summary,
                start,
                end: event.endDate ? event.endDate.toJSDate() : null,
                allDay: event.startDate.isDate,
              });
            }
          }
        }

        successCallback(events);
      } catch (err) {
        failureCallback(err as Error);
      }
    })();
  };

  const refetchEvents = async () => {
    // Force the server to re-pull the upstream ICS, then reload the calendar.
    try {
      await fetch(fetchCalUrl(true));
    } catch (e) {
      // ignore; refetchEvents below still reloads whatever the server has
    }
    calendarRef.current?.getApi().refetchEvents();
  };

  return (
    <div>
      <SpinnerContainer ref={spinnerRef}>
        <Spin />
      </SpinnerContainer>
      {isClientSide && !isNaN(courseId) && (
        <CalendarWrapper>
          <TimezoneNote>
            All times are shown in your local timezone: {timezoneAbbr} (
            {localTimezone})
          </TimezoneNote>
          <FullCalendar
            ref={calendarRef}
            plugins={[timeGridPlugin, dayGridPlugin, listPlugin]}
            events={loadEvents}
            scrollTime="08:00:00" // auto set each day's view to begin at 8AM
            nowIndicator={true} // red line marking the current time
            initialView={defaultView}
            headerToolbar={{
              start: "title",
              center: "dayGridMonth timeGridWeek timeGridDay listWeek",
              end: "today prev,next",
            }}
            loading={(loading) => {
              // FullCal is stupid so if you setState in this cb you get into an infinite render loop
              // https://stackoverflow.com/questions/66818770/fullcalendar-react-loading-function-problem
              // So we're just floating a spinner on top of the calendar and setting its display property
              if (spinnerRef.current)
                spinnerRef.current.style.display = loading ? "flex" : "none";
            }}
            height="70vh"
            eventContent={renderEventContent}
          />
        </CalendarWrapper>
      )}
      {role === Role.PROFESSOR && (
        <UpdateButton type="primary" onClick={refetchEvents}>
          Update Calendar
        </UpdateButton>
      )}
    </div>
  );
}

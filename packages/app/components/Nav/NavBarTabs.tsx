import React, { ReactElement, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { QueuePartial } from "@koh/common";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

export type NavBarTabsItem = NavBarGeneralTabItem | NavBarQueueTabItem;

interface NavBarGeneralTabItem {
  href: string;
  as: string;
  text: string;
}

interface NavBarQueueTabItem {
  text: string;
  queues: QueuePartial[];
  courseId: number;
}

interface NavBarTabsProps {
  currentHref: string;
  tabs: NavBarTabsItem[];
  horizontal?: boolean;
}

// Same box as the antd horizontal menu item: 16px text, 10px 50px padding,
// 46px line height, and a 2px underline on the active or hovered tab.
// top-px: antd's items sat 1px lower. after:border-solid: the mini reset in
// tailwind.css doesn't reach ::after, so its border style must be set here.
const horizontalTabClass =
  "relative top-px block whitespace-nowrap px-[50px] py-[10px] text-base leading-[46px] text-[#262626] " +
  "hover:text-primary after:absolute after:inset-x-0 after:bottom-0 after:border-b-2 after:border-solid after:border-transparent after:content-[''] hover:after:border-primary";
const horizontalActiveClass = "text-primary after:border-primary";

// The antd vertical menu item, for the phone menu: 40px tall, 16px padding
const verticalTabClass =
  "mb-2 block h-10 w-full rounded-md px-4 text-left text-sm leading-10 text-foreground hover:text-primary";
const verticalActiveClass = "bg-primary/10 text-primary";

function GeneralTab({
  tab,
  active,
  horizontal,
}: {
  tab: NavBarGeneralTabItem;
  active: boolean;
  horizontal?: boolean;
}): ReactElement {
  return (
    <Link href={tab.href} as={tab.as} passHref>
      <a
        aria-current={active ? "page" : undefined}
        className={cn(
          horizontal ? horizontalTabClass : verticalTabClass,
          active && (horizontal ? horizontalActiveClass : verticalActiveClass)
        )}
      >
        {tab.text}
      </a>
    </Link>
  );
}

// Opens on hover like the antd SubMenu (the Cypress check-in test hovers it),
// and on click or keyboard too. The short close delay lets the mouse move
// from the tab into the menu.
function QueueTab({
  item,
  horizontal,
}: {
  item: NavBarQueueTabItem;
  horizontal?: boolean;
}): ReactElement {
  const [open, setOpen] = useState(false);
  const closeTimer = useRef<number>();
  const show = () => {
    window.clearTimeout(closeTimer.current);
    setOpen(true);
  };
  const hideSoon = () => {
    window.clearTimeout(closeTimer.current);
    closeTimer.current = window.setTimeout(() => setOpen(false), 150);
  };
  useEffect(() => () => window.clearTimeout(closeTimer.current), []);

  return (
    <DropdownMenu open={open} onOpenChange={setOpen} modal={false}>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          data-cy="queue-tab"
          className={horizontal ? horizontalTabClass : verticalTabClass}
          onMouseEnter={show}
          onMouseLeave={hideSoon}
          // Radix toggles on pointer down, which would close a menu the hover
          // just opened. Open on click instead (taps on phones, too).
          onPointerDown={(e) => e.preventDefault()}
          onClick={show}
        >
          {item.text}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="start"
        side={horizontal ? "bottom" : "right"}
        sideOffset={horizontal ? 7 : 4}
        className="min-w-[160px]"
        onMouseEnter={show}
        onMouseLeave={hideSoon}
      >
        {item.queues?.map((openQueue) => (
          <Link
            key={openQueue.id}
            href="/course/[cid]/queue/[qid]"
            as={`/course/${item.courseId}/queue/${openQueue.id}`}
            passHref
          >
            <DropdownMenuItem
              asChild
              data-cy={`queue-menu-item-${openQueue.room}`}
            >
              <a className="h-10 cursor-pointer px-4 text-sm text-foreground">
                {openQueue.room}
              </a>
            </DropdownMenuItem>
          </Link>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export default function NavBarTabs({
  currentHref,
  tabs,
  horizontal,
}: NavBarTabsProps): ReactElement {
  return (
    <div className={horizontal ? "flex" : "flex flex-col"}>
      {tabs.map((tab) =>
        tab.text !== "Queue" ? (
          <GeneralTab
            key={tab.text}
            tab={tab as NavBarGeneralTabItem}
            active={(tab as NavBarGeneralTabItem).href === currentHref}
            horizontal={horizontal}
          />
        ) : (
          <QueueTab
            key={tab.text}
            item={tab as NavBarQueueTabItem}
            horizontal={horizontal}
          />
        )
      )}
    </div>
  );
}

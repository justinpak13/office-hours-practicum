import { Role } from "@koh/common";
import {
  BookOpen,
  CircleHelp,
  Command,
  Info,
  LogOut,
  Settings,
} from "lucide-react";
import Link from "next/link";
import React, { ReactElement, ReactNode, useState } from "react";
import { useRoleInCourse } from "../../hooks/useRoleInCourse";
import { logout } from "../../utils/logout";
import SelfAvatar from "../common/SelfAvatar";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

interface ProfileDrawerProps {
  courseId: number;
}

const HELP_GUIDE_URL =
  "https://sandboxnu.notion.site/Khoury-Office-Hours-App-6eb1ee9f338f4b859cd89054f6503f43";

// One row of the profile menu (antd Menu.Item: 40px tall, 24px left padding)
const menuItemClass =
  "h-10 w-full justify-start gap-2.5 rounded-none px-6 font-normal text-foreground [&_svg]:size-3.5";

function Kbd({ children }: { children: ReactNode }): ReactElement {
  return (
    <kbd className="whitespace-nowrap rounded border bg-muted px-1.5 py-px font-mono text-xs">
      {children}
    </kbd>
  );
}

// "/" between keys is a separator, everything else is a key
type Shortcut = { keys: string[]; text: string };
const STUDENT_SHORTCUTS: Shortcut[] = [
  { keys: ["shift", "n"], text: "Create a new question" },
  { keys: ["shift", "e"], text: "Edit question" },
  { keys: ["enter"], text: "Finish writing question" },
];
const TA_SHORTCUTS: Shortcut[] = [
  { keys: ["shift", "h"], text: "Help the next student" },
  {
    keys: ["shift", "d"],
    text: "Delete the currently selected student's question",
  },
  { keys: ["up", "/", "down"], text: "Navigate through students" },
];

function ShortcutList({ role }: { role: Role }): ReactElement {
  const shortcuts = role === Role.STUDENT ? STUDENT_SHORTCUTS : TA_SHORTCUTS;
  return (
    <div className="grid grid-cols-[auto_1fr] items-center gap-x-3 gap-y-2 text-sm">
      {shortcuts.map(({ keys, text }) => (
        <React.Fragment key={text}>
          <span className="flex items-center gap-1">
            {keys.map((key, i) =>
              key === "/" ? <span key={i}>/</span> : <Kbd key={i}>{key}</Kbd>
            )}
          </span>
          <span>{text}</span>
        </React.Fragment>
      ))}
    </div>
  );
}

export default function ProfileDrawer({
  courseId,
}: ProfileDrawerProps): ReactElement {
  const [isPopoverOpen, setIsPopoverOpen] = useState(false);
  const [isShortcutsOpen, setIsShortcutsOpen] = useState(false);
  const role = useRoleInCourse(courseId);
  const close = () => setIsPopoverOpen(false);

  return (
    <>
      <Popover open={isPopoverOpen} onOpenChange={setIsPopoverOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            data-cy="avatar-button"
            aria-label="Profile menu"
            className="flex rounded-full"
          >
            <SelfAvatar size={40} />
          </button>
        </PopoverTrigger>
        <PopoverContent
          align="end"
          sideOffset={19}
          className="w-48 p-0 py-1"
          // Like antd: opening the menu doesn't move focus (no focus outline)
          onOpenAutoFocus={(e) => e.preventDefault()}
        >
          <nav className="flex flex-col gap-2">
            <Link
              href={{ pathname: "/settings", query: { cid: courseId } }}
              passHref
            >
              <Button asChild variant="ghost" className={menuItemClass}>
                <a onClick={close}>
                  <Settings aria-hidden />
                  Settings
                </a>
              </Button>
            </Link>
            <Button
              variant="ghost"
              className={menuItemClass}
              onClick={() => {
                close();
                setIsShortcutsOpen(true);
              }}
            >
              <Command aria-hidden />
              Keyboard Shortcuts
            </Button>
            <Button
              variant="ghost"
              className={menuItemClass}
              onClick={() => {
                window.open(HELP_GUIDE_URL);
                close();
              }}
            >
              <CircleHelp aria-hidden />
              Help Guide
            </Button>
            <Link href="/about" passHref>
              <Button asChild variant="ghost" className={menuItemClass}>
                <a onClick={close}>
                  <BookOpen aria-hidden />
                  About Us
                </a>
              </Button>
            </Link>
            <Button
              variant="ghost"
              data-cy="logout-button"
              className={menuItemClass}
              onClick={() => logout()}
            >
              <LogOut aria-hidden />
              Logout
            </Button>
          </nav>
        </PopoverContent>
      </Popover>

      {/* was antd Modal.info: title with an info icon, the list, an OK button */}
      <Dialog open={isShortcutsOpen} onOpenChange={setIsShortcutsOpen}>
        <DialogContent hideClose className="max-w-[416px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-3 text-base">
              <Info className="size-5 text-primary" aria-hidden />
              Queue Page Keyboard Shortcuts
            </DialogTitle>
          </DialogHeader>
          <div className="pl-8">
            <ShortcutList role={role} />
          </div>
          <DialogFooter>
            <Button size="sm" onClick={() => setIsShortcutsOpen(false)}>
              OK
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

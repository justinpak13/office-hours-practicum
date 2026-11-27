import { QueuePartial } from "@koh/common";
import { Check, ChevronsUpDown } from "lucide-react";
import { ReactElement, ReactNode, useEffect, useState } from "react";
import styled from "styled-components";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
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
import { cn } from "@/lib/utils";

interface QueueCheckInModalProps {
  visible: boolean;
  onSubmit: (queueId: number) => void;
  onCancel: () => void;
  button: ReactNode;
  queues: QueuePartial[];
}

const RoomSelectionContainer = styled.div`
  display: flex;
  flex-direction: row;
  justify-content: space-between;
  align-items: flex-end;
  flex-wrap: wrap;
  gap: 8px;
`;

const CheckInDropdownContainer = styled.div`
  display: flex;
  flex-direction: column;
  justify-content: flex-start;
  flex-grow: 7;
`;

const queueLabel = (q: QueuePartial) =>
  `${q.room} (${q.queueSize} waiting, ${q.staffList.length} staff)`;

// Like antd's Select filterOption: the label contains the search, any case
const containsSearch = (
  _value: string,
  search: string,
  keywords?: string[]
): number =>
  (keywords ?? []).join(" ").toLowerCase().includes(search.toLowerCase())
    ? 1
    : 0;

export default function QueueCheckInModal({
  visible,
  onSubmit,
  onCancel,
  button,
  queues,
}: QueueCheckInModalProps): ReactElement {
  const [queueToCheckInto, setQueueToCheckInto] = useState(-1);
  const [pickerOpen, setPickerOpen] = useState(false);

  // When there's only one queue, pre-select it so the TA can check in directly.
  useEffect(() => {
    if (queues?.length === 1) {
      setQueueToCheckInto(0);
    }
  }, [queues]);

  const close = () => {
    onCancel();
    setQueueToCheckInto(-1);
  };
  const picked = queues?.[queueToCheckInto];

  return (
    <Dialog open={visible} onOpenChange={(open) => !open && close()}>
      <DialogContent data-cy="check-in-modal" className="max-w-[520px]">
        <DialogHeader>
          <DialogTitle>Check into a queue</DialogTitle>
        </DialogHeader>
        <RoomSelectionContainer>
          <CheckInDropdownContainer>
            <h3 id="check-in-room-label">Search for an existing room</h3>
            <Popover open={pickerOpen} onOpenChange={setPickerOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  aria-expanded={pickerOpen}
                  aria-labelledby="check-in-room-label"
                  data-cy="select-existing-queue"
                  className="w-[200px] justify-between px-[11px] font-normal"
                >
                  <span className={cn("truncate", !picked && "text-[#bfbfbf]")}>
                    {picked ? queueLabel(picked) : "Select a queue"}
                  </span>
                  <ChevronsUpDown className="opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[280px] p-0" align="start">
                <Command filter={containsSearch}>
                  <CommandInput placeholder="Search rooms..." />
                  <CommandList>
                    <CommandEmpty>No queue found.</CommandEmpty>
                    <CommandGroup>
                      {queues.map((q, i) => (
                        <CommandItem
                          key={i}
                          // values are strings; the index picks the queue
                          value={String(i)}
                          keywords={[queueLabel(q)]}
                          data-cy={`select-queue-${q.room}`}
                          onSelect={(v) => {
                            setQueueToCheckInto(Number(v));
                            setPickerOpen(false);
                          }}
                        >
                          {queueLabel(q)}
                          <Check
                            className={cn(
                              "ml-auto",
                              i === queueToCheckInto
                                ? "opacity-100"
                                : "opacity-0"
                            )}
                          />
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </CheckInDropdownContainer>
          <>{button}</>
        </RoomSelectionContainer>
        <DialogFooter className="max-sm:gap-2">
          <Button variant="outline" onClick={close}>
            Cancel
          </Button>
          <Button
            data-cy="check-in-submit"
            disabled={queueToCheckInto < 0}
            onClick={() => onSubmit(queueToCheckInto)}
          >
            Check In
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

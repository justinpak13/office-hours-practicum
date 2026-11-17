// Working examples of every shadcn component in components/ui, next to antd.
// Tested on Next 12.3 + React 18. To try it: copy to packages/app/pages/ui-check.tsx,
// run `yarn dev` and open http://localhost:3000/ui-check (don't commit it).
import { ReactElement, useState } from "react";
import { Button as AntButton, Modal, message } from "antd";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { DateRange } from "react-day-picker";
import { format } from "date-fns";
import { CalendarIcon, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Dialog, DialogClose, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Pagination, PaginationContent, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious,
} from "@/components/ui/pagination";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Progress } from "@/components/ui/progress";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

const schema = z.object({ firstName: z.string().min(1, "First name is required") });

export default function UiCheck(): ReactElement {
  const [antOpen, setAntOpen] = useState(false);
  const [range, setRange] = useState<DateRange | undefined>();
  const [picked, setPicked] = useState("");
  const [saved, setSaved] = useState("");
  const form = useForm<z.infer<typeof schema>>({ resolver: zodResolver(schema), defaultValues: { firstName: "" } });

  return (
    <TooltipProvider>
      <div className="p-6 space-y-6 max-w-5xl">
        <div className="flex flex-wrap gap-2 items-center">
          <AntButton type="primary" data-cy="ant-open" onClick={() => setAntOpen(true)}>antd modal</AntButton>
          <AntButton data-cy="ant-msg" onClick={() => message.success("antd message")}>antd message</AntButton>
          <Modal title="antd modal" open={antOpen} onOk={() => setAntOpen(false)} onCancel={() => setAntOpen(false)}>
            <p>antd body</p>
          </Modal>
          <Button data-cy="toast" onClick={() => toast.success("Saved (Sonner)")}>Toast</Button>
          <Button variant="outline" disabled><Loader2 className="animate-spin" /> Loading</Button>
          <Badge>Badge</Badge><Badge variant="secondary">Tag</Badge><Badge variant="destructive">Error</Badge>
          <Avatar><AvatarFallback>KO</AvatarFallback></Avatar>
          <Tooltip><TooltipTrigger asChild><Button variant="ghost" data-cy="tip">Tooltip</Button></TooltipTrigger><TooltipContent>Tip</TooltipContent></Tooltip>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Card>
            <CardHeader><CardTitle>Form (react-hook-form + zod)</CardTitle></CardHeader>
            <CardContent>
              <Form {...form}>
                <form data-cy="form" onSubmit={form.handleSubmit((v) => setSaved(v.firstName))} className="space-y-3">
                  <FormField control={form.control} name="firstName" render={({ field }) => (
                    <FormItem>
                      <FormLabel>First Name</FormLabel>
                      <FormControl><Input data-cy="firstName" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <Button type="submit" data-cy="submit">Save</Button>
                  <span data-cy="saved">{saved && `saved ${saved}`}</span>
                </form>
              </Form>
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>Inputs</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <Textarea placeholder="Question text" />
              <div className="flex items-center gap-2"><Checkbox id="c1" data-cy="check" /><Label htmlFor="c1">Checkbox</Label></div>
              <RadioGroup defaultValue="a" className="flex gap-4">
                <div className="flex items-center gap-2"><RadioGroupItem value="a" id="r1" /><Label htmlFor="r1">Concept</Label></div>
                <div className="flex items-center gap-2"><RadioGroupItem value="b" id="r2" data-cy="radio-b" /><Label htmlFor="r2">Testing</Label></div>
              </RadioGroup>
              <div className="flex items-center gap-2"><Switch data-cy="switch" /><Label>Switch</Label></div>
              <Select><SelectTrigger className="w-48" data-cy="select"><SelectValue placeholder="Select a queue" /></SelectTrigger>
                <SelectContent><SelectItem value="online">Online</SelectItem><SelectItem value="room">Room 101</SelectItem></SelectContent></Select>
              <Progress value={60} />
            </CardContent>
          </Card>
        </div>

        <div className="flex flex-wrap gap-2 items-center">
          <Dialog><DialogTrigger asChild><Button data-cy="dialog">Dialog</Button></DialogTrigger>
            <DialogContent><DialogHeader><DialogTitle>Check into a queue</DialogTitle></DialogHeader></DialogContent></Dialog>
          <Dialog><DialogTrigger asChild><Button variant="outline" data-cy="dialog-noclose">Dialog without X</Button></DialogTrigger>
            <DialogContent hideClose data-cy="noclose-content" onEscapeKeyDown={(e) => e.preventDefault()} onInteractOutside={(e) => e.preventDefault()}>
              <DialogHeader><DialogTitle>You couldn&apos;t be found!</DialogTitle></DialogHeader>
              <DialogFooter><DialogClose asChild><Button data-cy="noclose-rejoin">Rejoin Queue</Button></DialogClose></DialogFooter>
            </DialogContent></Dialog>
          <AlertDialog><AlertDialogTrigger asChild><Button variant="destructive" data-cy="confirm">Delete queue</Button></AlertDialogTrigger>
            <AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Are you sure?</AlertDialogTitle>
              <AlertDialogDescription>Replaces antd Popconfirm.</AlertDialogDescription></AlertDialogHeader>
              <AlertDialogFooter><AlertDialogCancel>No</AlertDialogCancel><AlertDialogAction data-cy="confirm-yes">Yes</AlertDialogAction></AlertDialogFooter>
            </AlertDialogContent></AlertDialog>
          <Sheet><SheetTrigger asChild><Button variant="outline" data-cy="sheet">Sheet (Drawer)</Button></SheetTrigger>
            <SheetContent><SheetHeader><SheetTitle>Profile</SheetTitle></SheetHeader></SheetContent></Sheet>
          <DropdownMenu><DropdownMenuTrigger asChild><Button variant="outline" data-cy="menu">Dropdown</Button></DropdownMenuTrigger>
            <DropdownMenuContent><DropdownMenuItem>Settings</DropdownMenuItem><DropdownMenuItem>Log out</DropdownMenuItem></DropdownMenuContent></DropdownMenu>
          <Popover><PopoverTrigger asChild><Button variant="outline" data-cy="combo">{picked || "Combobox (searchable select)"}</Button></PopoverTrigger>
            <PopoverContent className="p-0 w-56"><Command><CommandInput placeholder="Search rooms..." data-cy="combo-search" /><CommandList>
              <CommandEmpty>No room.</CommandEmpty><CommandGroup>
                {["Online", "Room 101", "WVH 210"].map((r) => <CommandItem key={r} value={r} onSelect={() => setPicked(r)}>{r}</CommandItem>)}
              </CommandGroup></CommandList></Command></PopoverContent></Popover>
          <Popover><PopoverTrigger asChild><Button variant="outline" data-cy="range"><CalendarIcon />
            {range?.from ? `${format(range.from, "MMM d")} – ${range.to ? format(range.to, "MMM d") : ""}` : "Date range"}</Button></PopoverTrigger>
            <PopoverContent className="w-auto p-0"><Calendar mode="range" selected={range} onSelect={setRange} numberOfMonths={2} /></PopoverContent></Popover>
        </div>

        <Tabs defaultValue="a"><TabsList><TabsTrigger value="a">Profile</TabsTrigger><TabsTrigger value="b" data-cy="tab-b">Notifications</TabsTrigger></TabsList>
          <TabsContent value="a">Profile tab</TabsContent><TabsContent value="b">Notifications tab</TabsContent></Tabs>
        <Accordion type="single" collapsible><AccordionItem value="1"><AccordionTrigger data-cy="acc">Waiting In Line (6)</AccordionTrigger>
          <AccordionContent>Collapse replacement</AccordionContent></AccordionItem></Accordion>
        <Collapsible><CollapsibleTrigger asChild><Button variant="link">Collapsible</Button></CollapsibleTrigger><CollapsibleContent>Hidden</CollapsibleContent></Collapsible>
        <Alert><AlertTitle>Alert</AlertTitle><AlertDescription>Replaces antd Alert.</AlertDescription></Alert>
        <Separator />
        <Table><TableHeader><TableRow><TableHead>Name</TableHead><TableHead>Role</TableHead></TableRow></TableHeader>
          <TableBody><TableRow><TableCell>Will Stenzel</TableCell><TableCell>TA</TableCell></TableRow></TableBody></Table>
        <Pagination><PaginationContent><PaginationItem><PaginationPrevious href="#" /></PaginationItem>
          <PaginationItem><PaginationLink href="#" isActive>1</PaginationLink></PaginationItem><PaginationItem><PaginationNext href="#" /></PaginationItem></PaginationContent></Pagination>
        <div className="space-y-2"><Skeleton className="h-4 w-64" /><Skeleton className="h-4 w-48" /></div>
      </div>
    </TooltipProvider>
  );
}

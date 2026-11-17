# Converting antd to shadcn: the cheat sheet

The patterns below cover everything this app uses. If you need a pattern that isn't here, ask K before inventing one, so every screen ends up the same.

**Start by reading two files:**

- `packages/app/components/Settings/ProfileSettings.tsx` is a real screen already converted: antd Form → shadcn Form with validation and a toast.
- `docs/shadcn/ui-examples.tsx` has working code for all 30 components.

Import shadcn components from `@/components/ui/<name>`. Import icons from `lucide-react`.

## The 6 rules that prevent bugs

1. **Move every `data-cy` onto the new element.** For inputs, put it on the `<Input>` itself, not on a wrapper.
2. **Select values must be strings.** antd allowed numbers (`value={idx}`); shadcn doesn't. Use `value={String(idx)}`, and convert back with `Number(v)` in `onValueChange`.
3. **Triggers need a ref.** `TooltipTrigger asChild`, `DialogTrigger asChild` and similar pass a ref to their child. The child must be a shadcn component, an HTML element, a `styled(...)` component, or a component wrapped in `React.forwardRef`. A plain function component won't work; wrap it in a `<span>` or use `forwardRef`.
4. **Links are blue until antd is gone.** antd's global CSS colors every `<a>`. If you render a link as a button (`<Button asChild><a/></Button>`), add `className="text-foreground"`, or `text-primary-foreground` on the default variant.
5. **Convert a modal together with everything inside it.** shadcn popups (Select, Tooltip, Popover, DropdownMenu) sit below antd's modals (z-index 50 vs 1000). A shadcn Select inside an antd Modal opens *behind* it.
6. **Delete the antd leftovers in the files you convert:** imports, `.ant-…` CSS in that component's styled-components, and `styled(AntdThing)` wrappers. Keep `styled.div` layout wrappers if that's simpler; styled-components stays for now.

## Component by component

| antd | shadcn | Notes |
|---|---|---|
| `Button type="primary"` | `<Button>` | Default variant = the app's brand blue |
| `Button` (default) | `<Button variant="outline">` | |
| `Button danger` | `<Button variant="destructive">` | |
| `Button type="link"` / `type="text"` | `variant="link"` / `variant="ghost"` | |
| `size="small"` / `size="large"` | `size="sm"` / `size="lg"` | Icon-only: `size="icon"` |
| `icon={<PlusOutlined />}` | `<Button><Plus /> Add</Button>` | Icons go inside, as children |
| `loading` | `disabled` + `<Loader2 className="animate-spin" />` | |
| `htmlType="submit"` | `type="submit"` | |
| `message.success("…")` (29 uses) | `toast.success("…")` | `import { toast } from "sonner"`. `<Toaster />` is already in `_app.tsx`. Duration: `toast.success(text, { duration: 2000 })` (antd used seconds: `, 2`) |
| `notification.open({ message, description })` | `toast(message, { description })` | TAQueue.tsx, ReleaseNotes.tsx |
| `Tooltip title="…"` | `Tooltip` + `TooltipTrigger asChild` + `TooltipContent` | `TooltipProvider` is already in `_app.tsx` |
| `Modal visible onOk onCancel title footer` | `Dialog open onOpenChange` + `DialogContent` / `DialogHeader` / `DialogTitle` / `DialogFooter` | Put the buttons in `DialogFooter`. `closable={false}` → see below |
| `Popconfirm title okText cancelText onConfirm` | `AlertDialog` + `AlertDialogTrigger asChild` + `AlertDialogAction onClick` | Keep the same title and Yes/No text |
| `Input` / `Input.TextArea` | `Input` / `Textarea` | |
| `InputNumber` | `<Input type="number">` | Convert with `Number(e.target.value)` |
| `Form` + `Form.Item rules` + `Form.useForm` + `validateFields` (6 files) | `Form` + `FormField` + react-hook-form + zod | Copy the ProfileSettings.tsx pattern. Write the `rules` messages as a zod schema. |
| `Select` + `Option` | `Select` + `SelectTrigger` + `SelectValue` + `SelectContent` + `SelectItem` | `onChange` → `onValueChange`. Values are strings (rule 2) |
| `Select showSearch` (QueueCheckInModal) | Combobox: `Popover` + `Command` | See ui-examples.tsx, "Combobox" |
| `Select mode="multiple"` (SelectCourses) | Combobox with `Checkbox` in each `CommandItem` | Keep the chosen values in an array state |
| `Switch checked onChange` | `Switch checked onCheckedChange` | |
| `Checkbox onChange(e)` | `Checkbox onCheckedChange(checked)` | `checked` is `true`, `false` or `"indeterminate"` |
| `Radio.Group value onChange` | `RadioGroup value onValueChange` + `RadioGroupItem` + `Label` | |
| `Table dataSource columns` (3 files, no sorting) | `Table` / `TableHeader` / `TableRow` / `TableHead` / `TableBody` / `TableCell` | Loop over `dataSource` yourself. `pagination={false}` → nothing to do |
| `Tag color` / `Badge` | `<Badge variant="secondary">` (or `className="bg-…"`) | |
| `Divider` | `Separator` | A divider with text: a `flex` row with two `Separator`s around a span |
| `Spin` | `<Loader2 className="animate-spin" />` or `Skeleton` | |
| `Card title extra` | `Card` + `CardHeader` + `CardTitle` + `CardContent` | Put `extra` in the header, as a `flex justify-between` row |
| `Alert type message description` | `Alert` (`variant="destructive"` for errors) + `AlertTitle` + `AlertDescription` | |
| `Result status title subTitle extra` | A centered `div`: lucide icon + `h2` + `p` + buttons | |
| `Row gutter={16}` / `Col span={12}` | `className="flex gap-4"` / `className="basis-1/2"` (or `grid grid-cols-2 gap-4`) | |
| `Space` / `Space direction="vertical"` | `className="flex items-center gap-2"` / `"flex flex-col gap-2"` | |
| `Menu` as a vertical settings nav (SettingsPage, CourseAdminPanel) | A list of `Button`s: `variant={active ? "secondary" : "ghost"} className="w-full justify-start"` | `defaultSelectedKeys` → your `currentSettings` state |
| `Menu` as tabs (NavBarTabs, PopularTimes) | `Tabs` + `TabsList` + `TabsTrigger` (or links styled with `Button variant="ghost"`) | |
| `Dropdown overlay={menu}` | `DropdownMenu` + `DropdownMenuTrigger asChild` + `DropdownMenuContent` + `DropdownMenuItem` | |
| `Drawer` | `Sheet` + `SheetContent side="right"` (or `"left"`) | NavBar mobile menu, insights options |
| `Collapse` / `Panel` | `Accordion type="multiple"` + `AccordionItem` / `AccordionTrigger` / `AccordionContent` | One open at a time: `type="single" collapsible` |
| `Pagination` | `Pagination` + `PaginationContent` / `PaginationItem` / `PaginationLink` / `PaginationPrevious` / `PaginationNext` | You render the page numbers |
| `List` | `ul` / `div` with `space-y-2`, or `divide-y` | |
| `Avatar` | `Avatar` + `AvatarImage` + `AvatarFallback` | |
| `Typography.Text` / `Title` / `Paragraph` | `span` / `h2` / `p` with Tailwind classes | |
| `Skeleton` / `Progress` / `Popover` | `Skeleton` / `Progress value` / `Popover` + `PopoverTrigger asChild` + `PopoverContent` | |
| `DatePicker.RangePicker` (insights.tsx) | `Popover` + `Calendar mode="range"` | See ui-examples.tsx, "Date range". Format with `date-fns` |

## Patterns with code

### Modal → Dialog (StudentCantFindModal, real example)

Before:

```tsx
<Modal visible={props.visible} closable={false} title="You couldn't be found!"
  footer={[
    <Button key="leave" danger onClick={props.leaveQueue}>Leave Queue</Button>,
    <Button type="primary" key="rejoin" onClick={props.rejoinQueue}>Rejoin Queue</Button>,
  ]}>
  …body…
</Modal>
```

After:

```tsx
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

<Dialog open={props.visible}>
  {/* closable={false}: no close X, and Esc / outside clicks do nothing */}
  <DialogContent hideClose onEscapeKeyDown={(e) => e.preventDefault()} onInteractOutside={(e) => e.preventDefault()}>
    <DialogHeader><DialogTitle>You couldn't be found!</DialogTitle></DialogHeader>
    …body…
    <DialogFooter>
      <Button variant="destructive" onClick={props.leaveQueue}>Leave Queue</Button>
      <Button onClick={props.rejoinQueue}>Rejoin Queue</Button>
    </DialogFooter>
  </DialogContent>
</Dialog>
```

`hideClose` is a small addition to our `components/ui/dialog.tsx`; shadcn's own version doesn't have it. Three modals need it: StudentCantFindModal, StudentRemovedFromQueueModal and StudentQuestionRephraseModal. (NavBar's mobile `Drawer` also has `closable={false}`, but it becomes a `Sheet`. Keeping the Sheet's X is fine there.)

For a modal that can be closed: `<Dialog open={visible} onOpenChange={(open) => !open && onCancel()}>`.

### Popconfirm with a Tooltip inside (TAQueueDetailButtons, real example)

```tsx
<AlertDialog>
  <Tooltip>
    <TooltipTrigger asChild>
      <AlertDialogTrigger asChild>
        <RequeueButton data-cy="requeue-student-button">…</RequeueButton>  {/* must take a ref: rule 3 */}
      </AlertDialogTrigger>
    </TooltipTrigger>
    <TooltipContent>Requeue Student</TooltipContent>
  </Tooltip>
  <AlertDialogContent>
    <AlertDialogHeader>
      <AlertDialogTitle>Are you sure you want to send this student back to the queue?</AlertDialogTitle>
    </AlertDialogHeader>
    <AlertDialogFooter>
      <AlertDialogCancel>No</AlertDialogCancel>
      <AlertDialogAction onClick={async () => { toast.success(PRORITY_QUEUED_MESSAGE_TEXT, { duration: 2000 }); await changeStatus(LimboQuestionStatus.ReQueueing); }}>
        Yes
      </AlertDialogAction>
    </AlertDialogFooter>
  </AlertDialogContent>
</AlertDialog>
```

### Form (copy ProfileSettings.tsx)

```tsx
const schema = z.object({ notes: z.string().max(500, "Too long") });     // antd `rules` → zod (antd `required` = .min(1, msg); don't add .trim())
const form = useForm<z.infer<typeof schema>>({ resolver: zodResolver(schema), defaultValues: { notes: "" } });
const { isDirty } = form.formState;
// antd initialValues: fill when the data loads, but never over unsaved typing (SWR can refetch any time).
// Values from the server can be null: always `?? ""`.
useEffect(() => { if (queue && !isDirty) form.reset({ notes: queue.notes ?? "" }); }, [queue, isDirty, form]);

const onSubmit = async (values) => {
  const previous = data;
  try { await save(values); form.reset(values); toast.success("Saved"); }
  catch (e) { mutate(previous, false); mutate(); toast.error("Couldn't save. Please try again."); }   // show failures; undo optimistic updates even offline
};

<Form {...form}>
  <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">   {/* antd validateFields → handleSubmit */}
    <FormField control={form.control} name="notes" render={({ field }) => (
      <FormItem>
        <FormLabel>Queue notes</FormLabel>
        <FormControl><Textarea data-cy="queue-notes" {...field} /></FormControl>
        <FormMessage />
      </FormItem>
    )} />
    <Button type="submit" data-cy="save-notes" disabled={form.formState.isSubmitting}>Save</Button>
  </form>
</Form>
```

If the save button sits outside the form (an antd Modal footer, for example), give the form an `id` and use `<Button type="submit" form="that-id">`.

### Select with numbers (SelectCourses, AddOverrideInput)

```tsx
<Select value={String(selected)} onValueChange={(v) => setSelected(Number(v))}>
  <SelectTrigger className="w-48" data-cy="select-course"><SelectValue placeholder="Select a course" /></SelectTrigger>
  <SelectContent>
    {courses.map((c, idx) => <SelectItem key={c.name} value={String(idx)}>{c.name}</SelectItem>)}
  </SelectContent>
</Select>
```

`Role.STUDENT` and the other roles are strings already.

## Icons: @ant-design/icons → lucide-react

All 38 icons the app uses. I checked each lucide name against the installed version.

| antd | lucide | antd | lucide |
|---|---|---|---|
| ArrowLeftOutlined | ArrowLeft | LinkOutlined | Link |
| BellOutlined | Bell | LinkedinFilled | *none (lucide dropped brand icons)*: use an inline SVG or the word "LinkedIn" |
| BookOutlined | Book | LogoutOutlined | LogOut |
| CheckOutlined | Check | MacCommandOutlined | Command |
| ClockCircleOutlined | Clock | MinusCircleOutlined | CircleMinus |
| CloseOutlined | X | NotificationOutlined | Megaphone |
| CloudSyncOutlined | RefreshCw | PhoneOutlined | Phone |
| DeleteOutlined / DeleteTwoTone | Trash2 | PlusCircleOutlined | CirclePlus |
| DeleteRowOutlined | ListX | PlusOutlined | Plus |
| DownOutlined | ChevronDown | QuestionCircleOutlined | CircleHelp |
| EditOutlined | Pencil | QuestionOutlined | CircleQuestionMark |
| ExclamationCircleOutlined | CircleAlert | ReadOutlined | BookOpen |
| FrownOutlined | Frown | RightOutlined / LeftOutlined | ChevronRight / ChevronLeft |
| HourglassOutlined | Hourglass | SearchOutlined | Search |
| InfoCircleOutlined | Info | SettingOutlined | Settings |
| StopOutlined | Ban | TeamOutlined | Users |
| UndoOutlined | Undo2 | UploadOutlined | Upload |
| UserOutlined | User | WindowsOutlined | AppWindow |

Size icons with `className="size-4"` (`size-5` for larger ones). Inside a shadcn `Button`, icons are already sized.

## Before you open the PR

```bash
grep -nE 'from "antd|@ant-design/icons' <your files>     # must print nothing
yarn tsc && yarn lint                                     # 0 errors
```

Click through every screen you changed as the right role, and take before/after screenshots.

import { API } from "@koh/api-client";
import { DesktopNotifPartial, UpdateProfileParams } from "@koh/common";
import { zodResolver } from "@hookform/resolvers/zod";
import { CircleHelp, CircleMinus } from "lucide-react";
import { isEqual, pick } from "lodash";
import { HeaderTitle } from "./Styled";
import React, { ReactElement, useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import styled from "styled-components";
import useSWR from "swr";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
} from "@/components/ui/form";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useLocalStorage } from "../../hooks/useLocalStorage";
import {
  getEndpoint,
  getNotificationState,
  NotificationStates,
  registerNotificationSubscription,
  requestNotificationPermission,
} from "../../utils/notification";

const DeviceAddHeader = styled.div`
  display: flex;
  justify-content: space-between;
`;

const schema = z.object({ desktopNotifsEnabled: z.boolean() });
type NotificationsForm = z.infer<typeof schema>;

export default function NotificationsSettings(): ReactElement {
  const { data: profile, mutate } = useSWR(`api/v1/profile`, async () =>
    API.profile.index()
  );

  const form = useForm<NotificationsForm>({
    resolver: zodResolver(schema),
    defaultValues: { desktopNotifsEnabled: false },
  });
  const [soundEnabled, setSoundEnabled] = useLocalStorage<boolean>(
    "ta-queue-sound-enabled",
    true
  );

  // Fill the form when the profile loads, but never over unsaved changes
  const { isDirty } = form.formState;
  useEffect(() => {
    if (profile && !isDirty) {
      form.reset({
        desktopNotifsEnabled: profile.desktopNotifsEnabled ?? false,
      });
    }
  }, [profile, isDirty, form]);

  const editProfile = async (updateProfile: UpdateProfileParams) => {
    const newProfile = { ...profile, ...updateProfile };
    mutate(newProfile, false);
    await API.profile.patch(pick(newProfile, ["desktopNotifsEnabled"]));
    mutate();
    return newProfile;
  };

  const onSubmit = async (values: NotificationsForm) => {
    const previous = profile;
    try {
      await editProfile(values);
      const latest = form.getValues(); // includes edits made during the save
      form.reset(values);
      // Put back anything changed while the save was in flight, still unsaved
      for (const k of Object.keys(values) as (keyof NotificationsForm)[])
        if (!isEqual(latest[k], values[k]))
          form.setValue(k, latest[k], { shouldDirty: true });
      toast.success(
        "Your notification settings have been successfully updated"
      );
    } catch (e) {
      // Undo the optimistic update, even if the refetch can't reach the server
      mutate(previous, false);
      mutate();
      toast.error("Failed to update your notification settings");
    }
  };

  const desktopNotifsEnabled = form.watch("desktopNotifsEnabled");

  return profile ? (
    <>
      <HeaderTitle>
        <h1>Notifications</h1>
      </HeaderTitle>
      <Form {...form}>
        {/* Save sits outside the form, so Enter doesn't submit (as before) */}
        <form onSubmit={(e) => e.preventDefault()} className="mb-4 space-y-6">
          {/* Like antd: below 576px the label sits above its switch, no colon */}
          <div className="flex items-center gap-3 max-[575px]:flex-col max-[575px]:items-start max-[575px]:gap-2">
            <Label htmlFor="sound-enabled">
              Play sound when student joins queue (TA only)
              <span aria-hidden="true" className="max-[575px]:hidden">
                :
              </span>
            </Label>
            <Switch
              id="sound-enabled"
              checked={soundEnabled}
              onCheckedChange={(checked) => setSoundEnabled(checked)}
            />
          </div>
          <FormField
            control={form.control}
            name="desktopNotifsEnabled"
            render={({ field }) => (
              <FormItem className="flex items-center gap-3 space-y-0 max-[575px]:flex-col max-[575px]:items-start max-[575px]:gap-2">
                <FormLabel>
                  Enable notifications on all devices
                  <span aria-hidden="true" className="max-[575px]:hidden">
                    :
                  </span>
                </FormLabel>
                <FormControl>
                  <Switch
                    checked={field.value}
                    onCheckedChange={field.onChange}
                  />
                </FormControl>
              </FormItem>
            )}
          />
          {desktopNotifsEnabled && <DeviceNotifPanel />}
        </form>
      </Form>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            aria-label="Open help guide"
            className="float-right cursor-pointer rounded-sm border-0 bg-transparent p-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            onClick={() =>
              window.open(
                "https://sandboxnu.notion.site/Khoury-Office-Hours-App-6eb1ee9f338f4b859cd89054f6503f43"
              )
            }
          >
            <CircleHelp className="size-[25px]" />
          </button>
        </TooltipTrigger>
        <TooltipContent>Click for help guide</TooltipContent>
      </Tooltip>
      <Button
        onClick={form.handleSubmit(onSubmit)}
        disabled={form.formState.isSubmitting}
        className="mb-[15px]"
      >
        Save
      </Button>
    </>
  ) : null;
}

function useThisDeviceEndpoint(): null | string {
  const [endpoint, setEndpoint] = useState(null);
  useEffect(() => {
    (async () => setEndpoint(await getEndpoint()))();
  });
  return endpoint;
}

function renderDeviceInfo(
  device: DesktopNotifPartial,
  isThisDevice: boolean
): string {
  if (device.name) {
    return isThisDevice ? `${device.name} (This Device)` : device.name;
  } else {
    return isThisDevice ? "This Device" : "Other Device";
  }
}

function DeviceNotifPanel() {
  const thisEndpoint = useThisDeviceEndpoint();
  const { data: profile, mutate } = useSWR(`api/v1/profile`, async () =>
    API.profile.index()
  );
  const thisDesktopNotif = profile?.desktopNotifs?.find(
    (dn) => dn.endpoint === thisEndpoint
  );
  const unsupported =
    getNotificationState() === NotificationStates.browserUnsupported;
  const addButton = (
    <Button
      type="button"
      variant="outline"
      onClick={async () => {
        const canNotify = await requestNotificationPermission();
        if (canNotify === NotificationStates.notAllowed) {
          toast.warning("Please allow notifications in this browser");
        }
        if (canNotify === NotificationStates.granted) {
          await registerNotificationSubscription();
          mutate();
        }
      }}
      disabled={unsupported}
      className="mb-1"
    >
      Add This Device
    </Button>
  );
  return (
    <div>
      <DeviceAddHeader>
        <h3>Your Devices</h3>
        {!thisDesktopNotif &&
          (unsupported ? (
            // A disabled button gets no pointer events, so the span shows the tooltip
            <Tooltip>
              <TooltipTrigger asChild>
                <span tabIndex={0} className="inline-block">
                  {addButton}
                </span>
              </TooltipTrigger>
              <TooltipContent>
                Browser does not support notifications. Please use Chrome or
                Firefox, and not Incognito Mode.
              </TooltipContent>
            </Tooltip>
          ) : (
            addButton
          ))}
      </DeviceAddHeader>
      <ul className="m-0 list-none divide-y rounded-md border p-0">
        {profile.desktopNotifs?.length ? (
          profile.desktopNotifs.map((device: DesktopNotifPartial) => {
            const name = renderDeviceInfo(
              device,
              device.endpoint === thisEndpoint
            );
            return (
              <li
                key={device.id}
                className="flex items-center justify-between px-6 py-3"
              >
                <div>
                  {/* h4 like antd List.Item.Meta; reset to the div's old look */}
                  <h4 className="m-0 font-medium leading-[inherit] text-inherit [font-size:inherit]">
                    {name}
                  </h4>
                  <div className="text-sm text-muted-foreground">
                    {`Registered ${device.createdAt.toLocaleDateString()}`}
                  </div>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label={`Remove device ${name}`}
                  onClick={async () => {
                    await API.notif.desktop.unregister(device.id);
                    mutate();
                  }}
                >
                  <CircleMinus className="!size-5" />
                </Button>
              </li>
            );
          })
        ) : (
          <li className="px-6 py-4 text-center text-muted-foreground">
            No Devices Registered To Receive Notifications
          </li>
        )}
      </ul>
    </div>
  );
}

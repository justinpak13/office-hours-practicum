import { API } from "@koh/api-client";
import { UpdateProfileParams } from "@koh/common";
import { zodResolver } from "@hookform/resolvers/zod";
import { pick } from "lodash";
import { HeaderTitle } from "./Styled";
import React, { ReactElement, useEffect } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import useSWR from "swr";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";

// The message is required only while the switch is on, i.e. while it is visible
const schema = z
  .object({
    includeDefaultMessage: z.boolean(),
    defaultMessage: z.string(),
  })
  .refine((v) => !v.includeDefaultMessage || v.defaultMessage.length > 0, {
    message: "Please input your default message for Teams chat!",
    path: ["defaultMessage"],
  });
type TeamsForm = z.infer<typeof schema>;

export default function TeamsSettings(): ReactElement {
  const { data: profile, mutate } = useSWR(`api/v1/profile`, async () =>
    API.profile.index()
  );
  const form = useForm<TeamsForm>({
    resolver: zodResolver(schema),
    defaultValues: { includeDefaultMessage: false, defaultMessage: "" },
  });

  // Fill the form when the profile loads, but never over unsaved changes
  const { isDirty } = form.formState;
  useEffect(() => {
    if (profile && !isDirty) {
      form.reset({
        includeDefaultMessage: profile.includeDefaultMessage ?? false,
        defaultMessage: profile.defaultMessage ?? "",
      });
    }
  }, [profile, isDirty, form]);

  const editProfile = async (updateProfile: UpdateProfileParams) => {
    const newProfile = { ...profile, ...updateProfile };
    mutate(newProfile, false);
    await API.profile.patch(
      pick(newProfile, ["defaultMessage", "includeDefaultMessage"])
    );
    mutate();
    return newProfile;
  };

  const onSubmit = async (values: TeamsForm) => {
    const previous = profile;
    try {
      // With the switch off the hidden message isn't saved, as before
      await editProfile(
        values.includeDefaultMessage ? values : { includeDefaultMessage: false }
      );
      form.reset(values);
      toast.success("Your profile settings have been successfully updated");
    } catch (e) {
      // Undo the optimistic update, even if the refetch can't reach the server
      mutate(previous, false);
      mutate();
      toast.error("Your Teams settings couldn't be saved. Please try again.");
    }
  };

  const includeDefaultMessage = form.watch("includeDefaultMessage");

  return profile ? (
    <div>
      <HeaderTitle>
        <h1>Teams Settings</h1>
      </HeaderTitle>
      <Form {...form}>
        {/* Save sits outside the form, so Enter doesn't submit (as before) */}
        <form onSubmit={(e) => e.preventDefault()} className="mb-4 space-y-6">
          <FormField
            control={form.control}
            name="includeDefaultMessage"
            render={({ field }) => (
              <FormItem className="flex items-center gap-3 space-y-0">
                <FormLabel>Open Teams Chat with Default Message</FormLabel>
                <FormControl>
                  <Switch
                    checked={field.value}
                    onCheckedChange={field.onChange}
                  />
                </FormControl>
              </FormItem>
            )}
          />
          {includeDefaultMessage && (
            <FormField
              control={form.control}
              name="defaultMessage"
              render={({ field }) => (
                <FormItem className="max-w-3xl">
                  <FormLabel>Default Teams Message</FormLabel>
                  <FormControl>
                    <Textarea
                      data-cy="defaultMessageInput"
                      rows={4}
                      placeholder={
                        profile?.defaultMessage
                          ? profile?.defaultMessage
                          : "Enter Your Message Here"
                      }
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          )}
        </form>
      </Form>
      <Button
        onClick={form.handleSubmit(onSubmit)}
        disabled={form.formState.isSubmitting}
        className="mb-4"
      >
        Save
      </Button>
    </div>
  ) : null;
}

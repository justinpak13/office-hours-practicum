import { API } from "@koh/api-client";
import { UpdateProfileParams } from "@koh/common";
import { zodResolver } from "@hookform/resolvers/zod";
import { isEqual, pick } from "lodash";
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
import { Input } from "@/components/ui/input";

// Same rule as the antd form: required, no trimming
const schema = z.object({
  firstName: z.string().min(1, "Your name can't be empty!"),
  lastName: z.string().min(1, "Your name can't be empty!"),
});
type ProfileForm = z.infer<typeof schema>;

export default function ProfileSettings(): ReactElement {
  const { data: profile, mutate } = useSWR(`api/v1/profile`, async () =>
    API.profile.index()
  );
  const form = useForm<ProfileForm>({
    resolver: zodResolver(schema),
    defaultValues: { firstName: "", lastName: "" },
  });

  // Fill the form when the profile loads or changes (e.g. after a photo
  // upload), but never over what the user is typing. Names can be null.
  const { isDirty } = form.formState;
  useEffect(() => {
    if (profile && !isDirty) {
      form.reset({
        firstName: profile.firstName ?? "",
        lastName: profile.lastName ?? "",
      });
    }
  }, [profile, isDirty, form]);

  const editProfile = async (updateProfile: UpdateProfileParams) => {
    const newProfile = { ...profile, ...updateProfile };
    mutate(newProfile, false);
    await API.profile.patch(pick(newProfile, ["firstName", "lastName"]));
    mutate();
    return newProfile;
  };

  const onSubmit = async (values: ProfileForm) => {
    const previous = profile;
    try {
      await editProfile(values);
      const latest = form.getValues(); // includes edits made during the save
      form.reset(values); // saved: the form is clean again
      // Put back anything changed while the save was in flight, still unsaved
      for (const k of Object.keys(values) as (keyof ProfileForm)[])
        if (!isEqual(latest[k], values[k]))
          form.setValue(k, latest[k], { shouldDirty: true });
      toast.success("Your profile settings have been successfully updated");
    } catch (e) {
      // Undo the optimistic update, even if the refetch can't reach the server
      mutate(previous, false);
      mutate();
      toast.error("Your profile couldn't be saved. Please try again.");
    }
  };

  return profile ? (
    <div>
      <HeaderTitle>
        <h1>Personal Information</h1>
      </HeaderTitle>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="mb-4 space-y-4">
          <div className="flex flex-col gap-4 sm:flex-row">
            <FormField
              control={form.control}
              name="firstName"
              render={({ field }) => (
                <FormItem className="flex-1">
                  <FormLabel>First Name</FormLabel>
                  <FormControl>
                    <Input data-cy="firstNameInput" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="lastName"
              render={({ field }) => (
                <FormItem className="flex-1">
                  <FormLabel>Last Name</FormLabel>
                  <FormControl>
                    <Input data-cy="lastNameInput" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
          <Button
            type="submit"
            data-cy="saveButton"
            disabled={form.formState.isSubmitting}
          >
            Save
          </Button>
        </form>
      </Form>
    </div>
  ) : null;
}

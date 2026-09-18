import { formOptions } from "@tanstack/react-form";
import { z } from "zod";

export function formErrorMessages(errors: unknown[]): string {
  return errors
    .map((error) =>
      typeof error === "string"
        ? error
        : error && typeof error === "object" && "message" in error
          ? String(error.message)
          : "",
    )
    .filter(Boolean)
    .join(", ");
}

const requiredText = (label: string, max: number) =>
  z
    .string()
    .max(max, `${label} must be ${max} characters or fewer`)
    .refine((value) => value.trim().length > 0, `${label} is required`);

export const profileFormSchema = z.object({
  displayName: requiredText("Display name", 64),
  bio: z.string(),
});

export const draftFormSchema = z.object({
  title: requiredText("Title", 120),
  body: z.string(),
  tag: z.string(),
  newTag: z.string().max(32, "Tag must be 32 characters or fewer"),
  cover: z
    .custom<File>(
      (value) => typeof File !== "undefined" && value instanceof File,
      "Cover must be a file",
    )
    .refine((file) => file.size <= 1_000_000, "Cover must be 1 MB or smaller")
    .refine((file) => file.type.startsWith("image/"), "Cover must be an image")
    .nullable(),
});

export const profileFormOpts = formOptions({
  defaultValues: {
    displayName: "",
    bio: "",
  },
  validators: { onSubmit: profileFormSchema },
});

export const draftFormOpts = formOptions({
  defaultValues: {
    title: "",
    body: "",
    tag: "",
    newTag: "",
    cover: null as File | null,
  },
  validators: { onSubmit: draftFormSchema },
});

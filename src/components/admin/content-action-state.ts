import type { FieldErrors } from "@/lib/errors";

export type ContentActionState = {
  status: "idle" | "error";
  message: string | null;
  fieldErrors: FieldErrors | null;
};

export const initialContentActionState: ContentActionState = {
  status: "idle",
  message: null,
  fieldErrors: null,
};

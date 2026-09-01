import type { FieldErrors } from "@/lib/errors";

export type ContentActionState = {
  status: "idle" | "error";
  message: string | null;
  fieldErrors: FieldErrors | null;
  coverReferenceStatus?:
    | "reusable"
    | "rejected"
    | "removed"
    | "already-absent"
    | "preserved-in-use"
    | "cleanup-failed";
};

export const initialContentActionState: ContentActionState = {
  status: "idle",
  message: null,
  fieldErrors: null,
};

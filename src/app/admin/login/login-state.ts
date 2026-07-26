export type LoginState = {
  status: "idle" | "error";
  message: string | null;
  fieldErrors: {
    email?: string[];
    password?: string[];
  } | null;
};

export const initialLoginState: LoginState = {
  status: "idle",
  message: null,
  fieldErrors: null,
};

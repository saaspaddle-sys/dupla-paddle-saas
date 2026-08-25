export interface LoginFormState {
  status: "idle" | "success" | "error";
  message: string;
}

export const initialLoginState: LoginFormState = {
  status: "idle",
  message: "",
};

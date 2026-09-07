export interface CreateClubFormState {
  status: "idle" | "success" | "error";
  message: string;
}

export const initialCreateClubState: CreateClubFormState = {
  status: "idle",
  message: "",
};

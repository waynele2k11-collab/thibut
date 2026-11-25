/** Shared by the sign-in server actions and their forms. Pure. */
export interface SignInFormState {
  error: string | null;
}

export const INITIAL_SIGN_IN_FORM_STATE: SignInFormState = { error: null };

/**
 * One sentence for every failure at either step: wrong email, wrong password, wrong or reused
 * code, too many tries, an expired step, or sign-in not being set up. Nothing in the answer
 * says which.
 */
export const SIGN_IN_FAILED_MESSAGE =
  "That did not work. Check your details and try again in a little while.";

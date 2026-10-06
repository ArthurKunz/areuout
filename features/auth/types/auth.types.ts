export interface SignInProps {
  onSuccess: () => void
  onClose: () => void
}

export interface SignUpProps {
  // The flag says whether signUp already handed back a SESSION, which happens when
  // the project auto-confirms: there is nothing left to verify in that case.
  onSuccess: (email: string, alreadySignedIn: boolean) => void
  onClose: () => void
  // Handed back when the user returns from the verification step, so the address
  // they already typed is still standing there.
  initialEmail?: string
  // Offered next to the 'already taken' warning — the only thing left to do there.
  onSignIn: () => void
}

export interface VerifyProps {
  email: string
  onSuccess: () => void
}

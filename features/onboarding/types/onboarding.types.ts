export interface NameFormProps {
  onSuccess: (firstname: string, lastname: string) => void
}

export interface ProfilePictureFormProps {
  // Resolves once the profile row has been written, so the button can hold its
  // spinner across the upload AND the insert that follows it. True means the page is
  // leaving and the spinner stays; false means it failed and the button comes back.
  onSuccess: (avatarUrl: string | null, avatarColor: string) => Promise<boolean>
  onClose: () => void
  firstname: string
  lastname: string
}

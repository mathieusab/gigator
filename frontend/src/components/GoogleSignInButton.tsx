import { LogIn } from 'lucide-react';

type Props = {
  onClick: () => void | Promise<void>;
  disabled?: boolean;
};

export default function GoogleSignInButton({ onClick, disabled }: Props) {
  return (
    <button
      type="button"
      onClick={() => void onClick()}
      disabled={disabled}
      className="btn btn-primary"
    >
      <LogIn size={16} aria-hidden="true" />
      Sign in with Google
    </button>
  );
}

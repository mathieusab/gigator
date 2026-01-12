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
      style={{
        padding: '10px 14px',
        borderRadius: 8,
        border: '1px solid #ddd',
        background: disabled ? '#f5f5f5' : '#fff',
        cursor: disabled ? 'not-allowed' : 'pointer',
      }}
    >
      Sign in with Google
    </button>
  );
}

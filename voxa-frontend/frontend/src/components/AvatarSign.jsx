export default function AvatarSign() {
  const AVATAR_URL = "http://localhost:3000/";

  return (
    <div style={{ marginTop: 32 }}>
      <h3>Avatar Sign</h3>
      <iframe
        src={AVATAR_URL}
        title="Sign avatar"
        allow="microphone; camera"
        style={{
          width: "100%",
          height: 700,
          border: "1px solid #ddd",
          borderRadius: 12,
        }}
      />
    </div>
  );
}
import EmbedFrame from "./EmbedFrame";

// "Word Signs" page: camera-based Sign → Text from the Yap & Render app.
export default function WordSigns() {
  return (
    <EmbedFrame
      mode="sign"
      id="word-signs"
      label="Sign → Text · Words"
      title="Sign a word. We read it."
      subtitle="A second camera recogniser that works on word-level signs. Allow the camera, keep your hands in frame and sign clearly."
      hint="Tip: good light, plain background, one sign at a time. The camera stays on this device."
    />
  );
}

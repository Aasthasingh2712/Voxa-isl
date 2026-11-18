import EmbedFrame from "./EmbedFrame";

// "Text → Sign" page: 3D avatar signs typed or spoken English / Hindi in Indian Sign Language.
export default function SpeechToISL() {
  return (
    <EmbedFrame
      mode="text"
      id="text-to-sign"
      label="Speech / Text → Sign"
      title="Say it. See it signed."
      subtitle="Type or speak in English or Hindi and a 3D avatar signs it in Indian Sign Language. Words without a sign are fingerspelled."
      hint="Tip: use the Voice button for the mic, or tap a suggested phrase below the avatar. Voice input needs internet and Chrome/Edge."
    />
  );
}

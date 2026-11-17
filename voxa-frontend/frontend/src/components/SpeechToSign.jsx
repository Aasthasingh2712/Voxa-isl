import { useState, useRef, useEffect } from "react";

const SR =
  typeof window !== "undefined" &&
  (window.SpeechRecognition || window.webkitSpeechRecognition);

export default function SpeechToSign() {
  const [text, setText] = useState("");
  const [listening, setListening] = useState(false);
  const recRef = useRef(null);

  useEffect(() => () => recRef.current?.stop(), []);

  const toggleMic = () => {
    if (!SR) {
      alert("Voice input is browser me nahi chalta. Chrome ya Edge use karo.");
      return;
    }
    if (listening) {
      recRef.current?.stop();
      return;
    }
    const rec = new SR();
    rec.lang = "en-IN";
    rec.interimResults = true;
    rec.onresult = (e) =>
      setText(Array.from(e.results).map((r) => r[0].transcript).join(" "));
    rec.onend = () => setListening(false);
    rec.onerror = () => setListening(false);
    recRef.current = rec;
    rec.start();
    setListening(true);
  };

  const words = text
    .toUpperCase()
    .split(/\s+/)
    .map((w) => w.replace(/[^A-Z]/g, ""))
    .filter(Boolean);

  return (
    <div style={{ marginTop: 32 }}>
      <h3>Text / Voice to Sign</h3>
      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Type karo ya mic dabao..."
          style={{ flex: 1, padding: 10 }}
        />
        <button onClick={toggleMic}>{listening ? "Stop" : "Mic"}</button>
        <button onClick={() => setText("")}>Clear</button>
      </div>

      {words.map((word, wi) => (
        <div key={wi} style={{ display: "flex", gap: 6, marginBottom: 12, flexWrap: "wrap" }}>
          {word.split("").map((ch, ci) => (
            <div key={ci} style={{ width: 72, textAlign: "center" }}>
              <img
                src={`/signs/${ch}.jpg`}
                alt={ch}
                width={72}
                height={72}
                style={{ objectFit: "cover", borderRadius: 8 }}
                onError={(e) => (e.currentTarget.style.visibility = "hidden")}
              />
              <div style={{ fontWeight: 600 }}>{ch}</div>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

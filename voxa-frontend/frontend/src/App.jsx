import Navbar from "./components/Navbar";
import Hero from "./components/Hero";
import ProblemStatement from "./components/ProblemStatement";
import ISLStats from "./components/ISLStats";
import Translator from "./components/Translator";
import TranslationHistory from "./components/TranslationHistory";
import HowItWorks from "./components/HowItWorks";
import Features from "./components/Features";
import About from "./components/About";
import Footer from "./components/Footer";
import { useTranslator } from "./hooks/useTranslator";

export default function App() {
  const translator = useTranslator();

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg-base)" }}>
      <Navbar />

      <main>
        <Hero />
        <ProblemStatement />
        <ISLStats />
        <Translator translator={translator} />

        <TranslationHistory
          history={translator.history}
          onSpeak={translator.speakText}
          onClear={translator.clearHistory}
        />

        <HowItWorks />
        <Features />
        <About />
      </main>

      <Footer />
    </div>
  );
}
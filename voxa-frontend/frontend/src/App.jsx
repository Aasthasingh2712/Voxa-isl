import { useEffect, useState } from "react";
import Navbar from "./components/Navbar";
import Hero from "./components/Hero";
import ProblemStatement from "./components/ProblemStatement";
import ISLStats from "./components/ISLStats";
import Translator from "./components/Translator";
import SpeechToISL from "./components/SpeechToISL";
import WordSigns from "./components/WordSigns";
import TranslationHistory from "./components/TranslationHistory";
import HowItWorks from "./components/HowItWorks";
import Features from "./components/Features";
import About from "./components/About";
import Footer from "./components/Footer";
import { useTranslator } from "./hooks/useTranslator";
import "./components/embed-pages.css";

// Separate "pages", chosen by the URL hash. Anything else (#home, #how-it-works, #about, ...) is the home page.
const PAGES = ["translator", "text-to-sign", "word-signs"];
const currentPage = () => {
  const id = window.location.hash.replace("#", "");
  return PAGES.includes(id) ? id : "home";
};

export default function App() {
  const translator = useTranslator();
  const [page, setPage] = useState(currentPage);

  useEffect(() => {
    const onHash = () => setPage(currentPage());
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  // After switching page: scroll to the requested home section, otherwise to the top.
  useEffect(() => {
    const id = window.location.hash.replace("#", "");
    if (page === "home" && id && id !== "home") {
      requestAnimationFrame(() =>
        document.getElementById(id)?.scrollIntoView({ behavior: "smooth" })
      );
    } else {
      window.scrollTo(0, 0);
    }
  }, [page]);

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg-base)" }}>
      <Navbar />

      <main>
        {page === "home" && (
          <>
            <Hero />
            <ProblemStatement />
            <ISLStats />
            <HowItWorks />
            <Features />
            <About />
          </>
        )}

        {page === "translator" && (
          <div className="page-view-wrap">
            <Translator translator={translator} />
            <TranslationHistory
              history={translator.history}
              onSpeak={translator.speakText}
              onClear={translator.clearHistory}
            />
          </div>
        )}

        {page === "text-to-sign" && <SpeechToISL />}
        {page === "word-signs" && <WordSigns />}
      </main>

      <Footer />
    </div>
  );
}

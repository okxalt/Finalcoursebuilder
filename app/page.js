"use client";

import { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

export default function HomePage() {
  const [currentStep, setCurrentStep] = useState("idea");
  const [userInput, setUserInput] = useState("");
  const [opportunities, setOpportunities] = useState([]);
  const [selectedOpportunity, setSelectedOpportunity] = useState(null);
  const [numChapters, setNumChapters] = useState(7);
  const [courseOutline, setCourseOutline] = useState(null);
  const [generatedContent, setGeneratedContent] = useState([]);
  const [currentChapterIndex, setCurrentChapterIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [credits, setCredits] = useState(null);

  async function safeJson(res) {
    try {
      return await res.json();
    } catch {
      return null;
    }
  }

  async function handleDiscover() {
    try {
      setIsLoading(true);
      setError(null);
      await refreshCredits();
      const res = await fetch("/api/discover", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic: userInput }),
      });
      if (!res.ok) {
        const body = await safeJson(res);
        throw new Error(body?.error || `Failed to fetch opportunities (${res.status})`);
      }
      const data = await res.json();
      if (!Array.isArray(data)) throw new Error("Unexpected response format");
      setOpportunities(data);
      setCurrentStep("opportunities");
    } catch (e) {
      setError(e.message);
    } finally {
      setIsLoading(false);
    }
  }

  function handleSelectOpportunity(title) {
    setSelectedOpportunity(title);
    setCurrentStep("outline");
  }

  async function handleGenerateOutline() {
    try {
      setIsLoading(true);
      setError(null);
      await refreshCredits();
      const res = await fetch("/api/outline", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ opportunityTitle: selectedOpportunity, numChapters }),
      });
      if (!res.ok) {
        const body = await safeJson(res);
        throw new Error(body?.error || `Failed to generate outline (${res.status})`);
      }
      const outline = await res.json();
      setCourseOutline(outline);
      setGeneratedContent([]);
      setCurrentChapterIndex(0);
      setCurrentStep("generation");
    } catch (e) {
      setError(e.message);
    } finally {
      setIsLoading(false);
    }
  }

  async function handleGenerateNextChapter() {
    if (!courseOutline) return;
    const idx = currentChapterIndex;
    if (idx >= courseOutline.chapters.length) return;
    try {
      setIsLoading(true);
      setError(null);
      await refreshCredits();
      const chapter = courseOutline.chapters[idx];
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          courseTitle: courseOutline.title ?? selectedOpportunity,
          chapterTitle: chapter.title,
          learningObjectives: Array.isArray(chapter.summary) ? chapter.summary : [],
        }),
      });
      if (!res.ok) {
        const body = await safeJson(res);
        throw new Error(body?.error || `Failed to generate chapter (${res.status})`);
      }
      const { content } = await res.json();
      setGeneratedContent((prev) => [...prev, content]);
      setCurrentChapterIndex((prev) => prev + 1);
    } catch (e) {
      setError(e.message);
    } finally {
      setIsLoading(false);
    }
  }

  async function refreshCredits() {
    try {
      const res = await fetch("/api/credits", { cache: "no-store" });
      if (!res.ok) return;
      const data = await res.json();
      setCredits(data.credits);
    } catch {}
  }

  async function devTopup() {
    try {
      const res = await fetch("/api/credits", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: 5 }),
      });
      if (!res.ok) return;
      const data = await res.json();
      setCredits(data.credits);
    } catch {}
  }

  return (
    <main className="space-y-8">
      <header className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-extrabold tracking-tight">AI Course Creator</h1>
            <p className="text-gray-700">Generate a complete course or ebook from a single idea.</p>
          </div>
          <div className="flex items-center gap-3 text-sm text-gray-700">
            <span className="rounded-full bg-white/70 backdrop-blur px-3 py-1 border border-white/40 shadow">Credits: {credits ?? "–"}</span>
            <button onClick={refreshCredits} className="glass-button px-3 py-1">Refresh</button>
            <button onClick={devTopup} className="glass-button px-3 py-1">Dev top-up +5</button>
          </div>
        </div>
      </header>

      {error && (
        <div className="rounded-md border border-red-300 bg-red-50 p-3 text-red-800">{error}</div>
      )}

      {currentStep === "idea" && (
        <section className="space-y-4">
          <label className="block text-sm font-medium text-gray-700">Your idea or topic</label>
          <input
            type="text"
            value={userInput}
            onChange={(e) => setUserInput(e.target.value)}
            placeholder="A guide to sourdough baking for beginners"
            className="w-full rounded-md border border-gray-300 bg-white/70 backdrop-blur px-3 py-3 focus:border-black focus:outline-none"
          />
          <button
            onClick={handleDiscover}
            disabled={isLoading || userInput.trim().length === 0}
            className="inline-flex items-center rounded-md bg-gradient-to-r from-indigo-600 to-pink-500 px-5 py-2.5 text-white disabled:opacity-50 shadow hover:opacity-90"
          >
            {isLoading ? "Discovering..." : "Discover Opportunities"}
          </button>
        </section>
      )}

      {currentStep === "opportunities" && (
        <section className="space-y-4">
          <h2 className="text-xl font-semibold">Select an opportunity</h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {opportunities.map((title) => (
              <button
                key={title}
                onClick={() => handleSelectOpportunity(title)}
                className="text-left rounded-xl border border-white/40 frosted p-4 hover:border-white/60"
              >
                <span className="font-medium">{title}</span>
              </button>
            ))}
          </div>
          <div>
            <button
              onClick={() => setCurrentStep("idea")}
              className="text-sm text-gray-600 hover:underline"
            >
              ← Back
            </button>
          </div>
        </section>
      )}

      {currentStep === "outline" && (
        <section className="space-y-4">
          <h2 className="text-xl font-semibold">Outline configuration</h2>
          <div className="rounded-md border border-gray-200 bg-white p-4">
            <div className="mb-3 text-sm text-gray-700">
              Selected opportunity:
              <div className="mt-1 font-medium">{selectedOpportunity}</div>
            </div>
            <label className="block text-sm font-medium text-gray-700">Number of chapters</label>
            <input
              type="number"
              min={1}
              max={50}
              value={numChapters}
              onChange={(e) => setNumChapters(parseInt(e.target.value || "0", 10))}
              className="mt-1 w-32 rounded-md border border-gray-300 bg-white/70 backdrop-blur px-3 py-2 focus:border-black focus:outline-none"
            />
          </div>
          <div className="flex gap-3">
            <button
              onClick={handleGenerateOutline}
              disabled={isLoading}
              className="inline-flex items-center rounded-md bg-gradient-to-r from-indigo-600 to-pink-500 px-5 py-2.5 text-white disabled:opacity-50 shadow hover:opacity-90"
            >
              {isLoading ? "Generating..." : "Generate Outline"}
            </button>
            <button onClick={() => setCurrentStep("opportunities")} className="text-gray-600 hover:underline">
              Cancel
            </button>
          </div>
        </section>
      )}

      {currentStep === "generation" && courseOutline && (
        <section className="space-y-6">
          <div>
            <h2 className="text-2xl font-semibold">{courseOutline.title}</h2>
            <p className="text-gray-600">{selectedOpportunity}</p>
          </div>

          <details className="rounded-md border border-gray-200 bg-white p-4" open>
            <summary className="cursor-pointer font-medium">Outline</summary>
            <ol className="mt-3 list-decimal space-y-2 pl-5">
              {courseOutline.chapters.map((ch, i) => (
                <li key={i}>
                  <div className="font-medium">{ch.title}</div>
                  {Array.isArray(ch.summary) && (
                    <ul className="ml-5 list-disc text-sm text-gray-700">
                      {ch.summary.map((s, j) => (
                        <li key={j}>{s}</li>
                      ))}
                    </ul>
                  )}
                </li>
              ))}
            </ol>
          </details>

          <div className="space-y-6">
            {generatedContent.map((md, idx) => (
              <article key={idx} className="prose max-w-none prose-headings:scroll-mt-20">
                <h3 className="text-xl font-semibold">Chapter {idx + 1}</h3>
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{md}</ReactMarkdown>
              </article>
            ))}
          </div>

          {currentChapterIndex < courseOutline.chapters.length ? (
            <button
              onClick={handleGenerateNextChapter}
              disabled={isLoading}
              className="inline-flex items-center rounded-md bg-gradient-to-r from-indigo-600 to-pink-500 px-5 py-2.5 text-white disabled:opacity-50 shadow hover:opacity-90"
            >
              {isLoading ? "Generating..." : `Generate Chapter ${currentChapterIndex + 1}`}
            </button>
          ) : (
            <div className="rounded-md border border-green-300 bg-green-50 p-3 text-green-800">
              Course Complete!
            </div>
          )}

          {generatedContent.length === courseOutline.chapters.length && (
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                const payload = {
                  title: courseOutline.title,
                  chapters: courseOutline.chapters.map((ch, idx) => ({
                    title: ch.title,
                    summary: ch.summary,
                    content: generatedContent[idx] || "",
                  })),
                };
                const res = await fetch("/api/export", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify(payload),
                });
                if (!res.ok) {
                  const body = await safeJson(res);
                  setError(body?.error || `Failed to export (${res.status})`);
                  return;
                }
                const blob = await res.blob();
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                a.download = `${courseOutline.title}.docx`;
                document.body.appendChild(a);
                a.click();
                a.remove();
                URL.revokeObjectURL(url);
              }}
            >
              <button type="submit" className="inline-flex items-center rounded-md bg-gradient-to-r from-indigo-600 to-pink-500 px-5 py-2.5 text-white shadow hover:opacity-90">
                Download DOCX
              </button>
            </form>
          )}
          {generatedContent.length === courseOutline.chapters.length && (
            <button
              onClick={() => {
                setUserInput("");
                setOpportunities([]);
                setSelectedOpportunity(null);
                setCourseOutline(null);
                setGeneratedContent([]);
                setCurrentChapterIndex(0);
                setCurrentStep("idea");
              }}
              className="inline-flex items-center rounded-md border border-gray-300 bg-white/70 backdrop-blur px-4 py-2"
            >
              Create a new course
            </button>
          )}
        </section>
      )}
    </main>
  );
}

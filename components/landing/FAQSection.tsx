"use client";

import { useState } from "react";
import { useDictionary } from "@/lib/i18n/DictionaryProvider";

type FAQItem = {
  question: string;
  answer: string;
};

const FAQ_KEYS = [
  "personalizedPlans",
  "whatMakesDifferent",
  "trainAtHome",
  "customMeals",
  "missPlan",
  "progressMeasured",
  "switchPlans",
  "manageAccount",
] as const;

function FAQItem({ question, answer }: FAQItem) {
  const [open, setOpen] = useState(false);

  return (
    <div className="border-b border-zinc-100">
      <button
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between py-5 text-left"
        aria-expanded={open}
      >
        <span className="text-base font-medium text-zinc-900">{question}</span>
        <span
          className={`ml-4 shrink-0 text-lg leading-none transition-transform ${
            open ? "rotate-45 text-primary-fg" : "text-zinc-400"
          }`}
        >
          +
        </span>
      </button>
      {open && (
        <p className="pb-5 text-sm leading-relaxed text-zinc-500">{answer}</p>
      )}
    </div>
  );
}

export default function FAQSection() {
  const { dict } = useDictionary();
  const faq = dict.faq;

  const faqs: FAQItem[] = FAQ_KEYS.map((key) => ({
    question: faq.items[key].question,
    answer: faq.items[key].answer,
  }));

  return (
    <section id="faq" className="bg-zinc-50 py-24">
      <div className="mx-auto max-w-3xl px-6">
        {/* Heading */}
        <div className="mb-12 text-center">
          <p className="mb-3 text-sm font-medium uppercase tracking-widest text-zinc-400">
            {faq.eyebrow}
          </p>
          <h2 className="text-4xl font-bold tracking-tight text-zinc-900">
            {faq.headline}
          </h2>
        </div>

        {/* Accordion */}
        <div>
          {faqs.map((faq) => (
            <FAQItem key={faq.question} {...faq} />
          ))}
        </div>
      </div>
    </section>
  );
}

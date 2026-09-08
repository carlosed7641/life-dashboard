"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/* Tipos mínimos: la Web Speech API no está en el lib.dom de TypeScript.
   Se definen locales para no augmentar `Window` globalmente. */
type SRAlternative = { readonly transcript: string };
type SRResult = { readonly isFinal: boolean; readonly 0: SRAlternative; readonly length: number };
type SRResultList = { readonly length: number; readonly [i: number]: SRResult };
type SREvent = { readonly resultIndex: number; readonly results: SRResultList };
type SRErrorEvent = { readonly error: string };
type SpeechRecognitionInstance = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  start(): void;
  stop(): void;
  abort(): void;
  onstart: (() => void) | null;
  onresult: ((e: SREvent) => void) | null;
  onerror: ((e: SRErrorEvent) => void) | null;
  onend: (() => void) | null;
};
type SpeechRecognitionCtor = new () => SpeechRecognitionInstance;

const SILENCE_MS = 3000;

type UseSpeechOptions = {
  /** Cada fragmento final de la transcripción (ya recortado). */
  onTranscript: (text: string) => void;
  /** El dictado terminó (silencio o parada). `didTranscribe` = si dijo algo. */
  onEnd?: (didTranscribe: boolean) => void;
};

/**
 * Dictado por voz con la Web Speech API nativa del navegador. Sin dependencias,
 * sin backend. Devuelve el texto a quien llama; no envía nada por su cuenta.
 */
export function useSpeech({ onTranscript, onEnd }: UseSpeechOptions) {
  const [supported, setSupported] = useState(false);
  const [listening, setListening] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cbRef = useRef(onTranscript);
  const endRef = useRef(onEnd);
  useEffect(() => {
    cbRef.current = onTranscript;
    endRef.current = onEnd;
  });

  const apiRef = useRef<{ start: () => void; stop: () => void; toggle: () => void }>({
    start: () => {},
    stop: () => {},
    toggle: () => {},
  });

  useEffect(() => {
    const w = window as unknown as {
      SpeechRecognition?: SpeechRecognitionCtor;
      webkitSpeechRecognition?: SpeechRecognitionCtor;
    };
    const Ctor = w.SpeechRecognition ?? w.webkitSpeechRecognition;
    if (!Ctor) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- sincroniza disponibilidad de una API del navegador
    setSupported(true);

    const rec = new Ctor();
    rec.lang = "es-CO";
    rec.continuous = true;
    rec.interimResults = true;
    rec.maxAlternatives = 1;

    let running = false;
    let didTranscribe = false;
    let silence: ReturnType<typeof setTimeout> | null = null;
    const clearSilence = () => {
      if (silence) {
        clearTimeout(silence);
        silence = null;
      }
    };
    const armSilence = () => {
      clearSilence();
      silence = setTimeout(() => {
        try {
          rec.stop();
        } catch {
          /* ya detenido */
        }
      }, SILENCE_MS);
    };
    const doStart = () => {
      try {
        rec.start();
      } catch {
        /* ya en marcha */
      }
    };
    const doStop = () => {
      clearSilence();
      try {
        rec.stop();
      } catch {
        /* ya detenido */
      }
    };

    rec.onstart = () => {
      running = true;
      didTranscribe = false;
      setListening(true);
      setError(null);
      armSilence();
    };
    rec.onresult = (e) => {
      let finalText = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i];
        if (r.isFinal) finalText += r[0].transcript;
      }
      const clean = finalText.trim();
      if (clean) {
        didTranscribe = true;
        cbRef.current(clean);
      }
      armSilence();
    };
    rec.onerror = (e) => {
      if (e.error === "no-speech" || e.error === "aborted") return;
      setError(
        e.error === "not-allowed" || e.error === "service-not-allowed"
          ? "Necesito permiso del micrófono."
          : "No se pudo usar el dictado.",
      );
    };
    rec.onend = () => {
      running = false;
      setListening(false);
      clearSilence();
      endRef.current?.(didTranscribe);
    };

    apiRef.current = {
      start: doStart,
      stop: doStop,
      toggle: () => (running ? doStop() : doStart()),
    };

    return () => {
      clearSilence();
      rec.onstart = rec.onresult = rec.onerror = rec.onend = null;
      try {
        rec.abort();
      } catch {
        /* noop */
      }
      apiRef.current = { start: () => {}, stop: () => {}, toggle: () => {} };
    };
  }, []);

  const start = useCallback(() => apiRef.current.start(), []);
  const stop = useCallback(() => apiRef.current.stop(), []);
  const toggle = useCallback(() => apiRef.current.toggle(), []);

  return { supported, listening, error, start, stop, toggle };
}

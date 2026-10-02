"use client";

import React, { useRef } from "react";
import Link from "next/link";
import { Terminal, ArrowRight, ShieldCheck, Cpu, Bot } from "lucide-react";
import { Button } from "@/components/ui/button";

export function LaserFlowShowcase() {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const revealImgRef = useRef<HTMLDivElement | null>(null);

  return (
    <section className="relative py-16 sm:py-24 w-full z-10 font-sans overflow-hidden">
      {/* Background Glow Blobs for the entire section */}
      <div className="absolute top-[10%] -left-[10%] w-[50%] h-[50%] bg-sky-500/10 blur-[120px] rounded-full pointer-events-none -z-10" />
      <div className="absolute bottom-[10%] -right-[10%] w-[50%] h-[50%] bg-blue-600/10 blur-[120px] rounded-full pointer-events-none -z-10" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="relative z-10 text-center max-w-5xl mx-auto mb-10">
        <h2 className="text-2xl sm:text-4xl md:text-5xl font-extrabold text-white tracking-tight leading-tight sm:whitespace-nowrap">
          System Architecture &amp; <span className="text-sky-400">Agent Pipeline</span>
        </h2>
      </div>

      {/* Static Layout Container */}
      <div className="relative min-h-[480px]">
        {/* Base Visible UI Content */}
        <div className="relative z-10 p-6 sm:p-10 flex flex-col justify-between h-full min-h-[480px]">


          {/* Center Card Matrix */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 my-6 group">
            {/* Left Column (Full Height) */}
            <div className="rounded-none p-6 md:p-8 bg-white/[0.02] border border-white/10 hover:border-sky-500/30 transition-all duration-[400ms] cursor-pointer group-hover:blur-[10px] group-hover:scale-90 hover:!blur-none hover:!scale-110 hover:!z-10 relative flex flex-col justify-end min-h-[220px] md:min-h-[280px]">
              <div>
                <div className="w-12 h-12 rounded-full bg-sky-500/10 border border-sky-400/20 flex items-center justify-center text-sky-400 mb-4">
                  <Bot className="w-5 h-5 md:w-6 md:h-6" />
                </div>
                <h3 className="text-lg md:text-xl font-bold text-white mb-2">167 AI Agents</h3>
                <p className="text-sm text-slate-300 leading-relaxed font-normal">
                  Structured across 19 technical divisions: AI Engineering, FAANG Prep, Cybersecurity, Data, Cloud &amp; DevRel.
                </p>
              </div>
            </div>

            {/* Right Column (2 Rows) */}
            <div className="flex flex-col gap-4">
              <div className="rounded-none p-5 bg-white/[0.02] border border-white/10 hover:border-sky-500/30 transition-all duration-[400ms] cursor-pointer group-hover:blur-[10px] group-hover:scale-90 hover:!blur-none hover:!scale-110 hover:!z-10 relative flex-1 flex flex-col justify-center">
                <div className="w-9 h-9 rounded-lg bg-sky-500/10 border border-sky-400/20 flex items-center justify-center text-sky-400 mb-3">
                  <Cpu className="w-4 h-4" />
                </div>
                <h3 className="text-sm font-bold text-white mb-1">Multi-Provider LLMs</h3>
                <p className="text-xs text-slate-300 leading-relaxed font-normal">
                  Seamless local &amp; cloud gateway switching: Ollama, OpenAI, Anthropic, Gemini, Groq, and DeepSeek.
                </p>
              </div>

              <div className="rounded-none p-5 bg-white/[0.02] border border-white/10 hover:border-sky-500/30 transition-all duration-[400ms] cursor-pointer group-hover:blur-[10px] group-hover:scale-90 hover:!blur-none hover:!scale-110 hover:!z-10 relative flex-1 flex flex-col justify-center">
                <div className="w-9 h-9 rounded-lg bg-sky-500/10 border border-sky-400/20 flex items-center justify-center text-sky-400 mb-3">
                  <ShieldCheck className="w-4 h-4" />
                </div>
                <h3 className="text-sm font-bold text-white mb-1">Local-First Storage</h3>
                <p className="text-xs text-slate-300 leading-relaxed font-normal">
                  Resumes, mock interviews, and repo audits operate locally via SQLite and indexed JSON schemas.
                </p>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-4 pt-4">
            <div className="text-xs sm:text-base text-slate-400 font-mono leading-relaxed">
              ✓ Open standard integration with <br className="block sm:hidden" />
              Cursor, Claude Code, Windsurf &amp; Antigravity
            </div>
            <Link href="/dashboard" className="w-full sm:w-auto">
              <button className="group relative overflow-hidden bg-transparent border-[3px] border-[#00a1b7] rounded-md px-6 py-2.5 cursor-pointer transition-transform duration-300 ease-[cubic-bezier(0.83,0,0.17,1)] active:scale-[0.98] active:brightness-90 after:absolute after:inset-[50%] after:-translate-x-1/2 after:-translate-y-1/2 after:h-[350%] after:w-0 after:rotate-[30deg] after:bg-[#00a1b7] after:transition-all after:duration-[1000ms] after:ease-[cubic-bezier(0.83,0,0.17,1)] hover:after:w-[150%] w-full sm:w-auto flex items-center justify-center">
                <span className="relative z-10 font-bold text-[#00a1b7] text-sm sm:text-base transition-colors duration-[700ms] ease-[cubic-bezier(0.83,0,0.17,1)] group-hover:text-[#202020]">
                  Open Workspace
                </span>
              </button>
            </Link>
          </div>
        </div>
      </div>
      </div>
    </section>
  );
}

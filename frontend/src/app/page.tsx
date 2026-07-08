"use client";

import { useEffect, useRef } from "react";
import Image from "next/image";

export default function Home() {
  const glassCardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Intersection Observer for fade-in animations
    const observerOptions = {
      threshold: 0.1,
      rootMargin: "0px 0px -50px 0px",
    };

    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("visible");
          
          // Counter Animation logic
          const counters = entry.target.querySelectorAll("[data-target]");
          counters.forEach((counter) => {
            const htmlElement = counter as HTMLElement;
            if (htmlElement.dataset.animated === "true") return;
            htmlElement.dataset.animated = "true";
            
            const target = parseInt(htmlElement.getAttribute("data-target") || "0", 10);
            let count = 0;
            const duration = 2000;
            const increment = target / (duration / 16);
            
            const updateCount = () => {
              count += increment;
              if (count < target) {
                htmlElement.innerText = Math.ceil(count).toLocaleString();
                requestAnimationFrame(updateCount);
              } else {
                htmlElement.innerText = target.toLocaleString() + (target > 5 ? "+" : "");
              }
            };
            
            updateCount();
          });
        }
      });
    }, observerOptions);

    document.querySelectorAll(".fade-in").forEach((el) => observer.observe(el));

    // Lightweight atmospheric effect: Mouse parallax on hero card
    const handleMouseMove = (e: MouseEvent) => {
      if (glassCardRef.current) {
        const { clientX, clientY } = e;
        const centerX = window.innerWidth / 2;
        const centerY = window.innerHeight / 2;
        const moveX = (clientX - centerX) / 50;
        const moveY = (clientY - centerY) / 50;
        
        glassCardRef.current.style.transform = `translate(${moveX}px, ${moveY}px)`;
      }
    };
    
    document.addEventListener("mousemove", handleMouseMove);
    
    return () => {
      observer.disconnect();
      document.removeEventListener("mousemove", handleMouseMove);
    };
  }, []);

  return (
    <>
      <nav className="docked full-width top-0 sticky z-50 bg-brand-saffron/90 backdrop-blur-md shadow-sm">
        <div className="flex justify-between items-center w-full px-margin-mobile md:px-margin-desktop py-4 max-w-container-max-width mx-auto">
          <div className="flex items-center gap-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img alt="NitiFlow Logo" className="h-10 w-auto" src="https://lh3.googleusercontent.com/aida/AP1WRLueH7q9CJBC3H6tsX4dNU7PggubRm5Y0zajhj5BHqJGXMo9LpkgOhcpFw5kBUYFcOFIqUZ8jveZ2fhsAEbtHbHQtGzrSWCW2ezfRCoNz6d2hwrKOOhOecfyTLGETuxGlBRwUfIQSUNO2vu99fPk80z37cIcLtbPRTFnRGSHKE6Cg7591OUdjwYV5oQzKNUAXi-kO01JZY_CNjEYbZCeHRKJ-RYUYDDkHERsNa-bsQsf29Nq8tlOWTGjNLE" />
            <span className="font-title-lg text-title-lg font-bold text-brand-navy">NitiFlow</span>
          </div>
          <div className="hidden md:flex items-center gap-8">
            <a className="text-on-surface-variant font-body-md text-body-md hover:text-primary transition-colors duration-200" href="#">For Citizens</a>
            <a className="text-on-surface-variant font-body-md text-body-md hover:text-primary transition-colors duration-200" href="#">For MPs</a>
            <a className="text-on-surface-variant font-body-md text-body-md hover:text-primary transition-colors duration-200" href="#">How it works</a>
          </div>
          <div className="flex items-center gap-4">
            <button className="bg-brand-navy text-white px-6 py-2 rounded-lg font-label-md text-label-md hover:bg-on-secondary-fixed transition-all active:scale-95">
              MP Login
            </button>
            <button className="md:hidden text-brand-navy">
              <span className="material-symbols-outlined">menu</span>
            </button>
          </div>
        </div>
      </nav>

      <main>
        {/* Hero Section */}
        <section className="relative overflow-hidden pt-20 pb-32 bg-brand-saffron bg-[url('https://lh3.googleusercontent.com/aida-public/AB6AXuAKJ46voUpZlY70wcX3VRLy2CDsK6G__XxCBsL6OBvTQQxgirxVk2Cvlav9m8MyleB5Kr04px49KK6ZcfGZLe6ZgXYn_O4Dk16gPxqvGDvSOjGVGRp-J0FULnzqFdyGZt4SH9KwNx0ruXtUYEgO7h8za8St5Ft8V5dEziIm93ZFQmy6FW9EbHfr3f9THvOvrJ3TpNHkPhCmdx4P9GcEmY99rwKNjQOWjKOaTIyvYFxuNonBTmtW-k7YUMTcA3S8wHhKJjBJsOdPBqcB')] bg-cover bg-center bg-no-repeat bg-blend-multiply">
          <div className="px-margin-mobile md:px-margin-desktop max-w-container-max-width mx-auto">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
              <div className="fade-in">
                <div className="inline-flex items-center gap-2 bg-primary-container/10 border border-primary-container/20 px-4 py-1.5 rounded-full mb-6">
                  <span className="text-primary font-label-md text-label-md tracking-wider">Google · Gemini · Built for Bharat</span>
                </div>
                <h1 className="font-display-lg-mobile md:font-display-lg text-display-lg-mobile md:text-display-lg text-brand-charcoal mb-6 leading-tight">
                  From complaints to clarity. <br/>
                  <span className="text-brand-navy italic">In every language.</span>
                </h1>
                <p className="text-body-lg font-body-lg text-on-surface-variant mb-10 max-w-xl">
                  NitiFlow turns thousands of citizen voices into one evidence-backed priority list for your constituency. Empowering MPs with AI-driven intelligence.
                </p>
                <div className="flex flex-col sm:flex-row gap-4">
                  <button className="bg-brand-saffron text-white px-8 py-4 rounded-lg font-title-lg text-title-lg shadow-lg hover:shadow-xl hover:-translate-y-0.5 transition-all">
                    Submit a Grievance
                  </button>
                  <button className="border-2 border-brand-navy text-brand-navy px-8 py-4 rounded-lg font-title-lg text-title-lg hover:bg-brand-navy hover:text-white transition-all">
                    View Dashboard
                  </button>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Counter Row */}
        <section className="bg-brand-off-white pt-12 pb-12 border-t border-surface-container-highest px-margin-mobile md:px-margin-desktop max-w-container-max-width mx-auto">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 fade-in">
            <div className="text-center">
              <div className="text-brand-navy font-display-lg-mobile text-display-lg-mobile font-bold" data-target="18">0</div>
              <div className="text-on-surface-variant font-label-md text-label-md">Wards Covered</div>
            </div>
            <div className="text-center">
              <div className="text-brand-navy font-display-lg-mobile text-display-lg-mobile font-bold" data-target="2400">0</div>
              <div className="text-on-surface-variant font-label-md text-label-md">Voices Heard</div>
            </div>
            <div className="text-center">
              <div className="text-brand-navy font-display-lg-mobile text-display-lg-mobile font-bold" data-target="5">0</div>
              <div className="text-on-surface-variant font-label-md text-label-md">Languages Supported</div>
            </div>
            <div className="text-center">
              <div className="text-brand-green font-display-lg-mobile text-display-lg-mobile font-bold flex items-center justify-center gap-1">
                <span className="material-symbols-outlined text-3xl">radar</span>
                <span>Real-time</span>
              </div>
              <div className="text-on-surface-variant font-label-md text-label-md">Intelligence Updates</div>
            </div>
          </div>
        </section>

        {/* How it works */}
        <section className="bg-brand-off-white py-32 px-margin-mobile md:px-margin-desktop border-t border-surface-container-low/50">
          <div className="max-w-container-max-width mx-auto">
            <div className="text-center mb-20 fade-in">
              <h2 className="font-headline-md text-headline-md text-brand-navy mb-4">A Smarter Path to Governance</h2>
              <p className="text-on-surface-variant max-w-2xl mx-auto">From raw data to strategic action in four simple steps.</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-12">
              <div className="relative fade-in text-center group">
                <div className="w-20 h-20 bg-white shadow-lg rounded-2xl flex items-center justify-center mx-auto mb-6 group-hover:bg-brand-saffron group-hover:text-white transition-all duration-300">
                  <span className="material-symbols-outlined text-4xl">mic</span>
                </div>
                <h4 className="font-title-lg text-title-lg text-brand-charcoal mb-2">1. Citizens Speak</h4>
                <p className="text-body-md text-on-surface-variant px-4">Submit grievances in any regional language via voice or text.</p>
              </div>
              <div className="relative fade-in text-center group">
                <div className="w-20 h-20 bg-white shadow-lg rounded-2xl flex items-center justify-center mx-auto mb-6 group-hover:bg-brand-navy group-hover:text-white transition-all duration-300">
                  <span className="material-symbols-outlined text-4xl">psychology</span>
                </div>
                <h4 className="font-title-lg text-title-lg text-brand-charcoal mb-2">2. Gemini Understands</h4>
                <p className="text-body-md text-on-surface-variant px-4">AI categorizes, clusters, and detects urgency across dialects.</p>
              </div>
              <div className="relative fade-in text-center group">
                <div className="w-20 h-20 bg-white shadow-lg rounded-2xl flex items-center justify-center mx-auto mb-6 group-hover:bg-brand-green group-hover:text-white transition-all duration-300">
                  <span className="material-symbols-outlined text-4xl">bar_chart</span>
                </div>
                <h4 className="font-title-lg text-title-lg text-brand-charcoal mb-2">3. Data Meets Demand</h4>
                <p className="text-body-md text-on-surface-variant px-4">Ward demographics and historical data reveal the true need.</p>
              </div>
              <div className="relative fade-in text-center group">
                <div className="w-20 h-20 bg-white shadow-lg rounded-2xl flex items-center justify-center mx-auto mb-6 group-hover:bg-brand-charcoal group-hover:text-white transition-all duration-300">
                  <span className="material-symbols-outlined text-4xl">check_circle</span>
                </div>
                <h4 className="font-title-lg text-title-lg text-brand-charcoal mb-2">4. MP Decides</h4>
                <p className="text-body-md text-on-surface-variant px-4">Ranked priorities with evidence for informed fund allocation.</p>
              </div>
            </div>
          </div>
        </section>

        {/* Features */}
        <section className="bg-brand-off-white py-32 px-margin-mobile md:px-margin-desktop">
          <div className="max-w-container-max-width mx-auto">
            <div className="flex flex-col md:flex-row justify-between items-end mb-16 gap-6 fade-in">
              <div>
                <h2 className="font-headline-md text-headline-md text-brand-navy mb-4">Precision Governance Tools</h2>
                <p className="text-on-surface-variant max-w-xl">Deep-tech solutions designed for the complexities of Indian administrative landscape.</p>
              </div>
              <button className="text-brand-navy font-label-md text-label-md flex items-center gap-2 group">
                Explore all features 
                <span className="material-symbols-outlined group-hover:translate-x-1 transition-transform">arrow_forward</span>
              </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              <div className="bg-white p-10 rounded-2xl border-t-4 border-brand-saffron shadow-sm hover:shadow-xl transition-all fade-in">
                <div className="w-14 h-14 bg-brand-saffron/10 rounded-full flex items-center justify-center text-brand-saffron mb-8">
                  <span className="material-symbols-outlined text-3xl">translate</span>
                </div>
                <h3 className="font-headline-sm text-headline-sm text-brand-charcoal mb-4">Multilingual Voice AI</h3>
                <p className="text-body-md text-on-surface-variant mb-6">Breaks language barriers using state-of-the-art NLP to process audio in Hindi, Marathi, Telugu, and more.</p>
                <ul className="space-y-3 text-label-md text-on-surface-variant">
                  <li className="flex items-center gap-2"><span className="material-symbols-outlined text-brand-green text-sm">done</span> Real-time transcription</li>
                  <li className="flex items-center gap-2"><span className="material-symbols-outlined text-brand-green text-sm">done</span> Sentiment analysis</li>
                </ul>
              </div>
              <div className="bg-white p-10 rounded-2xl border-t-4 border-brand-navy shadow-sm hover:shadow-xl transition-all fade-in">
                <div className="w-14 h-14 bg-brand-navy/10 rounded-full flex items-center justify-center text-brand-navy mb-8">
                  <span className="material-symbols-outlined text-3xl">warning</span>
                </div>
                <h3 className="font-headline-sm text-headline-sm text-brand-charcoal mb-4">Chronic Issue Detection</h3>
                <p className="text-body-md text-on-surface-variant mb-6">Identifies systemic infrastructure failures that recur over time, moving beyond temporary fixes.</p>
                <ul className="space-y-3 text-label-md text-on-surface-variant">
                  <li className="flex items-center gap-2"><span className="material-symbols-outlined text-brand-green text-sm">done</span> Pattern recognition</li>
                  <li className="flex items-center gap-2"><span className="material-symbols-outlined text-brand-green text-sm">done</span> Urgency mapping</li>
                </ul>
              </div>
              <div className="bg-white p-10 rounded-2xl border-t-4 border-brand-green shadow-sm hover:shadow-xl transition-all fade-in">
                <div className="w-14 h-14 bg-brand-green/10 rounded-full flex items-center justify-center text-brand-green mb-8">
                  <span className="material-symbols-outlined text-3xl">map</span>
                </div>
                <h3 className="font-headline-sm text-headline-sm text-brand-charcoal mb-4">Dev Plan vs Citizen Demand</h3>
                <p className="text-body-md text-on-surface-variant mb-6">Visualizes the gap between existing government projects and what citizens actually need on the ground.</p>
                <ul className="space-y-3 text-label-md text-on-surface-variant">
                  <li className="flex items-center gap-2"><span className="material-symbols-outlined text-brand-green text-sm">done</span> GIS mapping</li>
                  <li className="flex items-center gap-2"><span className="material-symbols-outlined text-brand-green text-sm">done</span> Budget optimization</li>
                </ul>
              </div>
            </div>
          </div>
        </section>

        {/* Social Proof/Partner Section */}
        <section className="py-20 bg-brand-green text-white overflow-hidden">
          <div className="max-w-container-max-width mx-auto px-margin-mobile md:px-margin-desktop text-center">
            <p className="font-label-md text-label-md text-white/80 uppercase tracking-widest mb-12">Empowering Digital India</p>
            <div className="flex flex-wrap justify-center items-center gap-16 opacity-80 hover:opacity-100 transition-all duration-500">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-4xl">cloud_queue</span>
                <span className="font-bold text-xl">Google Cloud</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-4xl">hub</span>
                <span className="font-bold text-xl">India Stack</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-4xl">assured_workload</span>
                <span className="font-bold text-xl">MeitY Certified</span>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="bg-brand-green text-white">
        <div className="w-full py-12 px-margin-mobile md:px-margin-desktop max-w-container-max-width mx-auto grid grid-cols-1 md:grid-cols-2 gap-gutter">
          <div>
            <div className="flex items-center gap-2 mb-6">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img alt="NitiFlow Logo" className="h-8 w-auto" src="https://lh3.googleusercontent.com/aida/AP1WRLueH7q9CJBC3H6tsX4dNU7PggubRm5Y0zajhj5BHqJGXMo9LpkgOhcpFw5kBUYFcOFIqUZ8jveZ2fhsAEbtHbHQtGzrSWCW2ezfRCoNz6d2hwrKOOhOecfyTLGETuxGlBRwUfIQSUNO2vu99fPk80z37cIcLtbPRTFnRGSHKE6Cg7591OUdjwYV5oQzKNUAXi-kO01JZY_CNjEYbZCeHRKJ-RYUYDDkHERsNa-bsQsf29Nq8tlOWTGjNLE" />
              <span className="font-title-lg text-title-lg font-bold text-primary-container">NitiFlow</span>
            </div>
            <p className="font-body-md text-body-md text-white/80 mb-8 max-w-sm">
              © 2024 NitiFlow. Built for Digital India. Empowering Constituencies through AI. 
              Integrating data across all 18 Wards to provide seamless governance insights.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-8">
            <div className="space-y-4">
              <h4 className="font-label-md text-label-md text-white">Platform</h4>
              <ul className="space-y-2">
                <li><a className="font-label-md text-label-md text-white/80 hover:text-white transition-colors" href="#">Privacy Policy</a></li>
                <li><a className="font-label-md text-label-md text-white/80 hover:text-white transition-colors" href="#">Terms of Service</a></li>
              </ul>
            </div>
            <div className="space-y-4">
              <h4 className="font-label-md text-label-md text-white">Compliance</h4>
              <ul className="space-y-2">
                <li><a className="font-label-md text-label-md text-white/80 hover:text-white transition-colors" href="#">Data Security</a></li>
                <li><a className="font-label-md text-label-md text-white/80 hover:text-white transition-colors" href="#">Governance Standards</a></li>
              </ul>
            </div>
          </div>
        </div>
        <div className="border-t border-white/10 py-6 text-center">
          <p className="font-label-md text-label-md text-white/80 opacity-80">Technology Credits: Google Gemini, Firebase, Indian Regional NLP Models.</p>
        </div>
      </footer>
    </>
  );
}

"use client";

import React, { useState, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth, PersonaKey } from "@/contexts/AuthContext";
import { formatCurrencyIDR } from "@/lib/utils";
import {
  UtensilsCrossed,
  Laptop,
  ArrowRight,
  Sparkles,
  CheckCircle2,
  Clock,
  MapPin,
  ChevronRight,
  LogIn,
  Phone,
  Check,
  Crown,
  Menu,
  X,
  Mail,
  Instagram,
  MessageCircle,
  Calendar,
  PlusCircle,
  ShieldCheck,
  Flame,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { PublicCommunityEvent } from "@/types/event";

// Hero Slides Data
const HERO_SLIDES = [
  {
    id: 1,
    title: "Sajian Kuliner Artisan & Kopi Spesialti",
    subtitle: "Nikmati aneka seduhan kopi lokal pilihan dan hidangan kuliner premium multi-mitra dengan pemesanan mandiri cepat via QR Meja.",
    badge: "Layanan F&B DAGO",
    bgImage: "https://images.unsplash.com/photo-1501339847302-ac426a4a7cbb?q=80&w=1920&auto=format&fit=crop",
  },
  {
    id: 2,
    title: "Ruang Kerja Kolaboratif & Meeting Suite",
    subtitle: "Hot desk fleksibel, dedicated nomad desk, dan meeting room privat kedap suara dengan koneksi fiber optic dedicated berkecepatan tinggi.",
    badge: "Layanan Co-Working DAGO",
    bgImage: "https://images.unsplash.com/photo-1497366216548-37526070297c?q=80&w=1920&auto=format&fit=crop",
  },
  {
    id: 3,
    title: "Satu Ekosistem Terpadu Produktivitas & Rasa",
    subtitle: "DAGO Creative Hub memadukan kenyamanan bekerja, pilihan kuliner artisan, dan program membership loyalty dalam satu platform modern.",
    badge: "DAGO Creative Hub Bali",
    bgImage: "https://images.unsplash.com/photo-1527192491265-7e15c55b1ed2?q=80&w=1920&auto=format&fit=crop",
  },
];

export default function PublicLandingPage() {
  const router = useRouter();
  const { user, login } = useAuth();

  // Scroll State for Navbar Glassmorphism & Active Spy
  const [isScrolled, setIsScrolled] = useState(false);
  const [activeSection, setActiveSection] = useState("");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
  const isManualScrollingRef = React.useRef(false);
  const scrollTimeoutRef = React.useRef<NodeJS.Timeout | null>(null);

  // Hero Carousel State (Snappy 3.5-second transition)
  const [currentSlide, setCurrentSlide] = useState(0);

  // Community Events State for Landing Page
  const [communityEvents, setCommunityEvents] = useState<PublicCommunityEvent[]>([]);
  const [isLoadingEvents, setIsLoadingEvents] = useState(true);

  useEffect(() => {
    const fetchLandingEvents = async () => {
      try {
        const res = await fetch("/api/events");
        const json = await res.json();
        if (json.success && Array.isArray(json.data)) {
          // Display top 3 upcoming approved events
          setCommunityEvents(json.data.slice(0, 3));
        }
      } catch (err) {
        console.error("Failed to load landing events", err);
      } finally {
        setIsLoadingEvents(false);
      }
    };
    fetchLandingEvents();
  }, []);

  // Scroll detection & Active Section Spy
  useEffect(() => {
    const handleScroll = () => {
      const scrollPos = window.scrollY;
      setIsScrolled(scrollPos > 20);

      if (isManualScrollingRef.current) return;

      const sectionIds = ["services", "events", "about", "loyalty", "contact"];
      let current = "";
      for (const id of sectionIds) {
        const el = document.getElementById(id);
        if (el) {
          const top = el.offsetTop - 120;
          const height = el.offsetHeight;
          if (scrollPos >= top && scrollPos < top + height) {
            current = id;
            break;
          }
        }
      }
      setActiveSection(current);
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    handleScroll();
    return () => {
      window.removeEventListener("scroll", handleScroll);
      if (scrollTimeoutRef.current) clearTimeout(scrollTimeoutRef.current);
    };
  }, []);

  // Auto-advance hero carousel
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % HERO_SLIDES.length);
    }, 4000);
    return () => clearInterval(timer);
  }, []);

  const handleQuickModalLogin = async (personaKey: PersonaKey) => {
    await login(personaKey);
    setIsLoginModalOpen(false);
    if (personaKey === "CASHIER_SGR") router.push("/pos");
    else if (personaKey === "KITCHEN_SGR") router.push("/kitchen");
    else if (personaKey === "WAITER_SGR") router.push("/waiter");
    else if (personaKey === "CUSTOMER_DEMO") router.push("/customer");
    else router.push("/dashboard");
  };

  const scrollToSection = (id: string) => {
    const el = document.getElementById(id);
    if (el) {
      if (scrollTimeoutRef.current) clearTimeout(scrollTimeoutRef.current);
      isManualScrollingRef.current = true;
      setActiveSection(id);

      const navbarOffset = 76;
      const elementPosition = el.getBoundingClientRect().top;
      const offsetPosition = elementPosition + window.pageYOffset - navbarOffset;
      window.scrollTo({
        top: Math.max(0, offsetPosition),
        behavior: "smooth",
      });

      scrollTimeoutRef.current = setTimeout(() => {
        isManualScrollingRef.current = false;
      }, 700);
    }
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] dark:bg-[#0B0F17] text-slate-900 dark:text-slate-100 font-sans flex flex-col justify-between selection:bg-[#3B7A57] selection:text-white scroll-smooth overflow-x-hidden transition-colors duration-300">

      {/* 1. CLEAN & SPACIOUS GLASSMORPHISM NAVBAR */}
      <header
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ease-in-out ${isScrolled
          ? "bg-white/90 dark:bg-[#0B0F17]/90 backdrop-blur-xl shadow-md border-b border-slate-200/80 dark:border-white/10 py-3"
          : "bg-white/70 dark:bg-[#0B0F17]/60 backdrop-blur-md py-4 sm:py-5 border-b border-slate-200/40 dark:border-transparent"
          }`}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between">

          {/* Brand Logo & Name */}
          <Link href="/" className="flex items-center space-x-3 group relative">
            <div className="relative flex-shrink-0">
              <div className="absolute -inset-1 rounded-full bg-[#52B788]/20 blur-md opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />
              <div className="w-9 h-11 relative transition-transform duration-300 ease-out group-hover:scale-105 group-hover:-rotate-2">
                <Image
                  src="/logo-dago.png"
                  alt="DagoEng Logo"
                  width={36}
                  height={44}
                  priority
                  className="object-contain drop-shadow-md"
                />
              </div>
            </div>
            <div>
              <span className="font-black text-lg tracking-tight text-slate-900 dark:text-white block leading-none drop-shadow-xs transition-colors duration-200 group-hover:text-[#3B7A57] dark:group-hover:text-slate-100">
                DagoEng <span className="text-[#3B7A57] dark:text-[#52B788] transition-all duration-300 group-hover:text-[#2E6044] dark:group-hover:text-[#74c69d]">Creative Hub</span>
              </span>
              <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 tracking-wider uppercase transition-colors duration-200 group-hover:text-slate-700 dark:group-hover:text-slate-300">
                F&B Management & Coworking
              </span>
            </div>
          </Link>

          {/* Clean Desktop Nav Links - Ordered matching page DOM flow */}
          <nav className="hidden lg:flex items-center space-x-1 p-1.5 rounded-full bg-slate-100/90 dark:bg-white/5 backdrop-blur-md border border-slate-200/80 dark:border-white/10 text-xs font-semibold text-slate-600 dark:text-slate-300">
            {[
              { id: "services", label: "Layanan" },
              { id: "events", label: "Event Komunitas" },
              { id: "about", label: "Tentang" },
              { id: "loyalty", label: "Loyalty" },
              { id: "contact", label: "Kontak" },
            ].map((item) => {
              const isActive = activeSection === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => scrollToSection(item.id)}
                  className={`px-4 py-2 rounded-full transition-all duration-200 ease-out select-none ${isActive
                    ? "bg-[#3B7A57] text-white font-bold shadow-md shadow-[#3B7A57]/20"
                    : "text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200/70 dark:hover:bg-white/10 active:bg-slate-200 dark:active:bg-white/15"
                    }`}
                >
                  {item.label}
                </button>
              );
            })}
          </nav>

          {/* Action Buttons & Theme Toggle */}
          <div className="hidden sm:flex items-center space-x-3">
            <ThemeToggle variant="pill" />

            <Link href="/customer">
              <Button
                size="sm"
                className="text-xs h-10 px-5 font-bold bg-[#3B7A57] text-white hover:bg-[#2E6044] shadow-md shadow-[#3B7A57]/20 rounded-xl transition-all duration-300 hover:scale-105 active:scale-95 border border-[#52B788]/40 group"
              >
                <UtensilsCrossed className="w-3.5 h-3.5 mr-1.5 transition-transform duration-300 group-hover:rotate-12" />
                <span>Customer Portal</span>
              </Button>
            </Link>

            {/* Interactive Login Modal Button */}
            <Button
              onClick={() => setIsLoginModalOpen(true)}
              variant="outline"
              size="sm"
              className="text-xs h-10 px-4 font-bold bg-white dark:bg-white/5 backdrop-blur-md border border-slate-200 dark:border-white/20 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/15 hover:text-slate-900 dark:hover:text-white hover:border-slate-300 dark:hover:border-white/40 rounded-xl transition-all duration-300 hover:scale-105 active:scale-95 group shadow-xs"
            >
              <LogIn className="w-3.5 h-3.5 mr-1.5 text-[#3B7A57] dark:text-[#52B788] transition-transform duration-300 group-hover:translate-x-0.5" />
              <span>{user ? `Akun: ${user.name.split(" ")[0]}` : "Masuk Sistem"}</span>
            </Button>
          </div>

          {/* Mobile Menu Toggle Button & Theme Toggle */}
          <div className="flex sm:hidden items-center space-x-2">
            <ThemeToggle />
            <Link href="/customer">
              <Button size="sm" className="text-[11px] h-8 px-3 font-bold bg-[#3B7A57] hover:bg-[#2E6044] text-white rounded-lg shadow-sm hover:scale-105 active:scale-95 transition-all">
                Portal
              </Button>
            </Link>
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 rounded-xl bg-slate-100 dark:bg-white/10 text-slate-800 dark:text-white hover:bg-slate-200 dark:hover:bg-white/20 active:scale-90 transition-all duration-200 border border-slate-200 dark:border-transparent"
              aria-label="Toggle Menu"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>

        </div>

        {/* Mobile Dropdown Menu with Slide Animation */}
        {mobileMenuOpen && (
          <div className="sm:hidden px-4 pt-3 pb-6 bg-white/95 dark:bg-[#0B0F17]/95 backdrop-blur-2xl border-b border-slate-200 dark:border-white/10 space-y-3 animate-in fade-in slide-in-from-top-3 duration-300 shadow-xl">
            <div className="flex flex-col space-y-1.5 text-sm font-semibold text-slate-700 dark:text-slate-300">
              {[
                { id: "services", label: "Layanan (F&B & Coworking)" },
                { id: "events", label: "Event Komunitas" },
                { id: "about", label: "Tentang Dago" },
                { id: "loyalty", label: "Program Loyalty" },
                { id: "contact", label: "Kontak & Alamat" },
              ].map((item) => {
                const isActive = activeSection === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => {
                      setMobileMenuOpen(false);
                      scrollToSection(item.id);
                    }}
                    className={`p-2.5 rounded-xl text-left transition-all duration-200 ${isActive
                      ? "bg-[#3B7A57] text-white font-bold shadow-sm shadow-[#3B7A57]/20"
                      : "hover:bg-slate-100 dark:hover:bg-white/5 hover:text-slate-900 dark:hover:text-white"
                      }`}
                  >
                    {item.label}
                  </button>
                );
              })}
            </div>

            <div className="pt-3 border-t border-slate-200 dark:border-white/10 flex flex-col gap-2">
              <Link href="/customer" onClick={() => setMobileMenuOpen(false)}>
                <Button className="w-full bg-[#3B7A57] hover:bg-[#2E6044] text-white font-bold text-xs h-10 rounded-xl hover:scale-[1.02] active:scale-95 transition-all shadow-md shadow-[#3B7A57]/20">
                  Buka Customer Portal
                </Button>
              </Link>
              <Button
                onClick={() => {
                  setMobileMenuOpen(false);
                  setIsLoginModalOpen(true);
                }}
                variant="outline"
                className="w-full bg-slate-50 dark:bg-white/5 text-slate-800 dark:text-slate-200 border-slate-200 dark:border-white/20 font-bold text-xs h-10 rounded-xl hover:scale-[1.02] active:scale-95 transition-all"
              >
                Masuk / Login Multi-Role
              </Button>
            </div>
          </div>
        )}
      </header>

      {/* 2. HERO SLIDESHOW */}
      <section className="relative min-h-[580px] sm:min-h-[640px] lg:min-h-[700px] flex items-center justify-center overflow-hidden bg-slate-950 text-white pt-24 sm:pt-28 pb-16 sm:pb-20">
        {HERO_SLIDES.map((slide, idx) => (
          <div
            key={slide.id}
            className={`absolute inset-0 transition-all duration-700 ease-out ${idx === currentSlide
              ? "opacity-100 scale-100"
              : "opacity-0 scale-105 pointer-events-none"
              }`}
          >
            <div
              className="absolute inset-0 bg-cover bg-center transition-transform duration-[4000ms] ease-linear"
              style={{ backgroundImage: `url(${slide.bgImage})` }}
            />
            <div className="absolute inset-0 bg-gradient-to-t from-[#0B0F17] via-slate-950/75 to-slate-950/60" />
            <div className="absolute inset-0 bg-radial-gradient from-transparent via-slate-950/40 to-[#0B0F17]" />
          </div>
        ))}

        {/* Ambient Glow Aura in Sage Green */}
        <div className="absolute top-1/3 left-1/4 w-96 h-96 bg-[#52B788]/20 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-[#3B7A57]/15 rounded-full blur-3xl pointer-events-none" />

        {/* Hero Content Container */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14 relative z-20 w-full">
          <div className="max-w-3xl space-y-6">

            {/* Glowing Badge in Sage Green */}
            <div className="inline-flex items-center space-x-2 bg-[#52B788]/15 backdrop-blur-md border border-[#52B788]/40 text-[#52B788] px-4 py-1.5 rounded-full text-xs font-black uppercase tracking-wider shadow-md shadow-[#52B788]/15 animate-in fade-in duration-300">
              <Sparkles className="w-3.5 h-3.5 text-[#52B788] animate-spin" style={{ animationDuration: "6s" }} />
              <span>{HERO_SLIDES[currentSlide].badge}</span>
            </div>

            {/* Slide Title */}
            <h1 className="text-3xl sm:text-5xl lg:text-6xl font-black text-white tracking-tight leading-[1.14] drop-shadow-md">
              {HERO_SLIDES[currentSlide].title}
            </h1>

            {/* Slide Subtitle */}
            <p className="text-sm sm:text-base text-slate-200 leading-relaxed max-w-2xl font-normal drop-shadow-xs">
              {HERO_SLIDES[currentSlide].subtitle}
            </p>

            {/* Dual Core CTA Buttons (Direct to F&B and Co-Working) */}
            <div className="pt-2 flex flex-wrap items-center gap-3.5">
              <Link href="/customer?tab=MENU">
                <Button
                  size="lg"
                  className="h-12 px-7 font-bold bg-[#3B7A57] text-white hover:bg-[#2E6044] rounded-2xl text-xs shadow-xl shadow-[#3B7A57]/25 transition-all hover:scale-105 active:scale-95 border border-[#52B788]/30 flex items-center space-x-2"
                >
                  <UtensilsCrossed className="w-4 h-4" />
                  <span>Explore F&B</span>
                  <ArrowRight className="w-4 h-4 ml-1" />
                </Button>
              </Link>

              <Link href="/customer?tab=COWORKING">
                <Button
                  size="lg"
                  variant="outline"
                  className="h-12 px-7 font-bold bg-white/10 backdrop-blur-md border-white/20 text-white hover:bg-white/20 rounded-2xl text-xs transition-all hover:scale-105 active:scale-95 flex items-center space-x-2 shadow-sm"
                >
                  <Laptop className="w-4 h-4 text-[#52B788]" />
                  <span>Explore Co-Working</span>
                </Button>
              </Link>
            </div>

            {/* Slide Navigation Dots */}
            <div className="pt-4 flex items-center space-x-3">
              {HERO_SLIDES.map((_, idx) => (
                <button
                  key={idx}
                  onClick={() => setCurrentSlide(idx)}
                  className={`h-2 rounded-full transition-all duration-300 ${idx === currentSlide
                    ? "w-10 bg-[#52B788] shadow-md shadow-[#52B788]/30"
                    : "w-2.5 bg-white/30 hover:bg-white/60"
                    }`}
                  aria-label={`Slide ${idx + 1}`}
                />
              ))}
              <span className="text-xs text-slate-400 font-mono pl-2">
                0{currentSlide + 1} <span className="text-slate-600">/</span> 0{HERO_SLIDES.length}
              </span>
            </div>

          </div>
        </div>
      </section>

      {/* 3. SECTION: EXPLORE OUR SERVICES (F&B & COWORKING) */}
      <section id="services" className="py-24 bg-slate-100/70 dark:bg-[#0B0F17] transition-colors duration-300 relative scroll-mt-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">

          {/* Section Header */}
          <div className="text-center max-w-2xl mx-auto space-y-2">
            <Badge variant="outline" className="text-[#3B7A57] dark:text-[#52B788] border-[#3B7A57]/30 dark:border-[#52B788]/40 bg-[#3B7A57]/10 dark:bg-[#52B788]/10 font-black uppercase text-[10px] tracking-wider">
              Explore Our Services
            </Badge>
            <h2 className="text-2xl sm:text-4xl font-black text-slate-900 dark:text-white tracking-tight">
              Satu Ekosistem, Dua Layanan Utama
            </h2>
            <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400">
              DAGO Creative Hub menggabungkan kenyamanan ruang kerja modern dengan pilihan kuliner artisan terbaik dalam satu platform yang saling terintegrasi.
            </p>
          </div>

          {/* 2 Core Service Cards Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">

            {/* Service 1: F&B & Culinary */}
            <div className="p-8 rounded-3xl bg-white dark:bg-[#131B2B] border border-slate-200 dark:border-white/10 space-y-6 flex flex-col justify-between hover:border-[#52B788] hover:bg-gradient-to-b hover:from-emerald-50/40 dark:hover:from-emerald-950/20 hover:to-white dark:hover:to-[#131B2B] transition-all duration-300 shadow-md dark:shadow-xl group">
              <div className="space-y-5">
                <div className="flex items-center justify-between">
                  <div className="w-12 h-12 rounded-2xl bg-[#3B7A57]/10 text-[#3B7A57] dark:bg-[#52B788]/20 dark:text-[#52B788] border border-[#3B7A57]/20 dark:border-[#52B788]/30 flex items-center justify-center font-bold">
                    <UtensilsCrossed className="w-6 h-6" />
                  </div>
                  <Badge className="bg-[#3B7A57]/10 text-[#3B7A57] dark:bg-[#52B788]/20 dark:text-[#52B788] border border-[#3B7A57]/20 dark:border-[#52B788]/30 text-[10px] font-bold uppercase">
                    Kuliner & Kopi Spesialti
                  </Badge>
                </div>

                <div>
                  <h3 className="text-2xl font-black text-slate-900 dark:text-white group-hover:text-[#3B7A57] dark:group-hover:text-[#52B788] transition-colors">
                    Sajian Kuliner Artisan Multi-Mitra
                  </h3>
                  <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed mt-2">
                    Nikmati aneka hidangan lezat dan kopi berkualitas dari para mitra terpercaya DAGO — mulai dari seduhan Kopi Senja, hidangan nusantara Dapur Mama, hingga pastry manis Manis Bakery. Pesan mandiri via QR Meja dengan pembayaran instan.
                  </p>
                </div>

                {/* Tenant Badges */}
                <div className="flex flex-wrap gap-1.5 pt-1">
                  <span className="text-[11px] font-semibold px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-slate-700 dark:text-slate-300">
                    ☕ Kopi Senja
                  </span>
                  <span className="text-[11px] font-semibold px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-slate-700 dark:text-slate-300">
                    🍲 Dapur Mama
                  </span>
                  <span className="text-[11px] font-semibold px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-slate-700 dark:text-slate-300">
                    🥐 Manis Bakery
                  </span>
                  <span className="text-[11px] font-semibold px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-slate-700 dark:text-slate-300">
                    🍛 Warung Bu Narti
                  </span>
                </div>

                {/* Key Features */}
                <div className="pt-2 space-y-2 text-xs text-slate-600 dark:text-slate-300">
                  <div className="flex items-center space-x-2">
                    <CheckCircle2 className="w-4 h-4 text-[#3B7A57] dark:text-[#52B788] flex-shrink-0" />
                    <span>Pemesanan mandiri via scan QR Meja tanpa antrean kasir</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <CheckCircle2 className="w-4 h-4 text-[#3B7A57] dark:text-[#52B788] flex-shrink-0" />
                    <span>Pesanan otomatis terhubung ke Kitchen Display System (KDS) mitra</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <CheckCircle2 className="w-4 h-4 text-[#3B7A57] dark:text-[#52B788] flex-shrink-0" />
                    <span>Struk digital transparan & penambahan loyalty points otomatis</span>
                  </div>
                </div>

                {/* Popular Menu Preview */}
                <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 space-y-2">
                  <div className="flex items-center justify-between text-[11px] font-bold text-slate-700 dark:text-slate-300">
                    <span className="flex items-center space-x-1">
                      <Flame className="w-3.5 h-3.5 text-amber-500" />
                      <span>Menu Favorit Pengunjung:</span>
                    </span>
                    <span className="text-slate-500 dark:text-slate-400 font-normal">Harga Transparan</span>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-[11px]">
                    <div className="p-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 text-center">
                      <span className="font-bold text-slate-800 dark:text-white block truncate">Kopi Senja Aren</span>
                      <span className="text-[#3B7A57] dark:text-[#52B788] font-bold">{formatCurrencyIDR(24000)}</span>
                    </div>
                    <div className="p-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 text-center">
                      <span className="font-bold text-slate-800 dark:text-white block truncate">Nasi Beef Bowl</span>
                      <span className="text-[#3B7A57] dark:text-[#52B788] font-bold">{formatCurrencyIDR(45000)}</span>
                    </div>
                    <div className="p-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 text-center">
                      <span className="font-bold text-slate-800 dark:text-white block truncate">Butter Croissant</span>
                      <span className="text-[#3B7A57] dark:text-[#52B788] font-bold">{formatCurrencyIDR(20000)}</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="pt-6 border-t border-slate-100 dark:border-white/10">
                <Link href="/customer?tab=MENU">
                  <Button className="w-full h-12 bg-[#3B7A57] hover:bg-[#2E6044] text-white font-bold text-xs rounded-2xl shadow-lg shadow-[#3B7A57]/20 transition-all hover:scale-[1.02] active:scale-95 flex items-center justify-center space-x-2 border border-[#52B788]/30">
                    <UtensilsCrossed className="w-4 h-4" />
                    <span>Explore F&B & Pesan Mandiri</span>
                    <ArrowRight className="w-4 h-4" />
                  </Button>
                </Link>
              </div>
            </div>

            {/* Service 2: Co-Working & Workspace */}
            <div className="p-8 rounded-3xl bg-white dark:bg-[#131B2B] border border-slate-200 dark:border-white/10 space-y-6 flex flex-col justify-between hover:border-[#52B788] hover:bg-gradient-to-b hover:from-emerald-50/40 dark:hover:from-emerald-950/20 hover:to-white dark:hover:to-[#131B2B] transition-all duration-300 shadow-md dark:shadow-xl group">
              <div className="space-y-5">
                <div className="flex items-center justify-between">
                  <div className="w-12 h-12 rounded-2xl bg-[#3B7A57]/10 text-[#3B7A57] dark:bg-[#52B788]/20 dark:text-[#52B788] border border-[#3B7A57]/20 dark:border-[#52B788]/30 flex items-center justify-center font-bold">
                    <Laptop className="w-6 h-6" />
                  </div>
                  <Badge className="bg-[#3B7A57]/10 text-[#3B7A57] dark:bg-[#52B788]/20 dark:text-[#52B788] border border-[#3B7A57]/20 dark:border-[#52B788]/30 text-[10px] font-bold uppercase">
                    Ruang Kerja & Produktivitas
                  </Badge>
                </div>

                <div>
                  <h3 className="text-2xl font-black text-slate-900 dark:text-white group-hover:text-[#3B7A57] dark:group-hover:text-[#52B788] transition-colors">
                    Ruang Kerja Kolaboratif & Meeting Room
                  </h3>
                  <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed mt-2">
                    Fasilitas kerja representatif yang dirancang untuk freelancer, remote worker, profesional, dan tim yang membutuhkan ruang tenang, kolaboratif, serta didukung fasilitas audio visual lengkap.
                  </p>
                </div>

                {/* Workspace Badges */}
                <div className="flex flex-wrap gap-1.5 pt-1">
                  <span className="text-[11px] font-semibold px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-slate-700 dark:text-slate-300">
                    💻 Hot Desk Flex
                  </span>
                  <span className="text-[11px] font-semibold px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-slate-700 dark:text-slate-300">
                    🖥️ Dedicated Desk
                  </span>
                  <span className="text-[11px] font-semibold px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-slate-700 dark:text-slate-300">
                    🎙️ Focus Audio Pod
                  </span>
                  <span className="text-[11px] font-semibold px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-slate-700 dark:text-slate-300">
                    👥 Meeting Suite (10 Pax)
                  </span>
                </div>

                {/* Key Features */}
                <div className="pt-2 space-y-2 text-xs text-slate-600 dark:text-slate-300">
                  <div className="flex items-center space-x-2">
                    <CheckCircle2 className="w-4 h-4 text-[#3B7A57] dark:text-[#52B788] flex-shrink-0" />
                    <span>Koneksi internet dedicated fiber optic berkecepatan tinggi & stabil</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <CheckCircle2 className="w-4 h-4 text-[#3B7A57] dark:text-[#52B788] flex-shrink-0" />
                    <span>Reservasi fleksibel: pilihan sewa per jam, harian, atau bulanan</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <CheckCircle2 className="w-4 h-4 text-[#3B7A57] dark:text-[#52B788] flex-shrink-0" />
                    <span>Fasilitas lengkap: Smart TV 4K, audio conference, & free-flow water</span>
                  </div>
                </div>

                {/* Popular Workspace Preview */}
                <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 space-y-2">
                  <div className="flex items-center justify-between text-[11px] font-bold text-slate-700 dark:text-slate-300">
                    <span className="flex items-center space-x-1">
                      <ShieldCheck className="w-3.5 h-3.5 text-[#3B7A57] dark:text-[#52B788]" />
                      <span>Pilihan Ruang Tersedia:</span>
                    </span>
                    <span className="text-slate-500 dark:text-slate-400 font-normal">Pemesanan Langsung</span>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-[11px]">
                    <div className="p-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 text-center">
                      <span className="font-bold text-slate-800 dark:text-white block truncate">Hot Desk Flex</span>
                      <span className="text-[#3B7A57] dark:text-[#52B788] font-bold">Rp 15.000<span className="text-[10px] font-normal">/jam</span></span>
                    </div>
                    <div className="p-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 text-center">
                      <span className="font-bold text-slate-800 dark:text-white block truncate">Focus Audio Pod</span>
                      <span className="text-[#3B7A57] dark:text-[#52B788] font-bold">Rp 35.000<span className="text-[10px] font-normal">/jam</span></span>
                    </div>
                    <div className="p-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 text-center">
                      <span className="font-bold text-slate-800 dark:text-white block truncate">Meeting Room Alpha</span>
                      <span className="text-[#3B7A57] dark:text-[#52B788] font-bold">Rp 150.000<span className="text-[10px] font-normal">/jam</span></span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="pt-6 border-t border-slate-100 dark:border-white/10">
                <Link href="/customer?tab=COWORKING">
                  <Button className="w-full h-12 bg-[#3B7A57] hover:bg-[#2E6044] text-white font-bold text-xs rounded-2xl shadow-lg shadow-[#3B7A57]/20 transition-all hover:scale-[1.02] active:scale-95 flex items-center justify-center space-x-2 border border-[#52B788]/30">
                    <Laptop className="w-4 h-4" />
                    <span>Explore Co-Working & Reservasi Ruang</span>
                    <ArrowRight className="w-4 h-4" />
                  </Button>
                </Link>
              </div>
            </div>

          </div>

        </div>
      </section>

      {/* 4B. SECTION: EVENT KOMUNITAS (INFORMASI & PENGAJUAN PUBLIK) */}
      <section id="events" className="py-24 bg-white dark:bg-[#090D15] transition-colors duration-300 relative scroll-mt-20 border-t border-slate-200 dark:border-white/5">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">

          {/* Section Header */}
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 pb-2 border-b border-slate-200 dark:border-white/10">
            <div className="space-y-3 max-w-2xl">
              <div className="inline-flex items-center space-x-2 bg-[#3B7A57]/10 dark:bg-emerald-500/15 border border-[#3B7A57]/20 dark:border-emerald-500/30 text-[#3B7A57] dark:text-emerald-400 px-3.5 py-1 rounded-full text-xs font-black uppercase tracking-wider">
                <Calendar className="w-3.5 h-3.5 text-[#3B7A57] dark:text-emerald-400" />
                <span>Agenda & Komunitas Kreatif</span>
              </div>
              <h2 className="text-2xl sm:text-4xl font-black text-slate-900 dark:text-white tracking-tight leading-tight">
                Event Komunitas & Ruang Kolaborasi
              </h2>
              <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                Temukan lokakarya, perjumpaan komunitas, dan sharing session menarik yang diselenggarakan oleh komunitas lokal di DAGO Creative Hub.
              </p>
            </div>

            {/* CTA Buttons */}
            <div className="flex flex-wrap items-center gap-3">
              <Link href="/events/submit">
                <Button className="h-10 px-4 bg-[#3B7A57] hover:bg-[#2E6044] text-white text-xs font-bold rounded-xl shadow-lg shadow-[#3B7A57]/20 transition-all hover:scale-105 active:scale-95 flex items-center space-x-1.5 border border-[#52B788]/30">
                  <PlusCircle className="w-3.5 h-3.5" />
                  <span>Pasang Event Komunitas</span>
                </Button>
              </Link>
              <Link href="/events">
                <Button
                  variant="outline"
                  className="h-10 px-4 bg-slate-100 dark:bg-white/5 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-white/20 hover:bg-slate-200 dark:hover:bg-white/15 hover:text-slate-900 dark:hover:text-white text-xs font-bold rounded-xl transition-all hover:scale-105 active:scale-95 flex items-center space-x-1.5"
                >
                  <span>Lihat Semua Event</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </Button>
              </Link>
            </div>
          </div>

          {/* Events Grid */}
          {isLoadingEvents ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-96 rounded-3xl bg-slate-100 dark:bg-slate-900/60 border border-slate-200 dark:border-white/10 animate-pulse" />
              ))}
            </div>
          ) : communityEvents.length === 0 ? (
            <div className="p-12 text-center rounded-3xl bg-slate-50 dark:bg-slate-900/40 border border-slate-200 dark:border-white/10 max-w-xl mx-auto space-y-4">
              <Calendar className="w-12 h-12 text-slate-400 dark:text-slate-500 mx-auto" />
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">Belum Ada Agenda Komunitas Mendatang</h3>
              <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                Punya rencana mengadakan lokakarya, meetup, atau sesi sharing? Pasang pengajuan event komunitasmu di sini secara gratis.
              </p>
              <Link href="/events/submit">
                <Button className="bg-[#3B7A57] hover:bg-[#2E6044] text-white text-xs font-bold px-5 py-2.5 rounded-xl shadow-md shadow-[#3B7A57]/20">
                  Pasang Event Sekarang
                </Button>
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {communityEvents.map((evt) => (
                <div
                  key={evt.id}
                  className="group rounded-3xl bg-slate-50 dark:bg-[#131B2B] border border-slate-200 dark:border-white/10 hover:border-[#52B788] hover:bg-gradient-to-b hover:from-emerald-50/40 dark:hover:from-emerald-950/20 hover:to-slate-50 dark:hover:to-[#131B2B] transition-all duration-300 shadow-md dark:shadow-xl overflow-hidden flex flex-col justify-between"
                >
                  <div>
                    {/* Poster Header */}
                    <div className="relative h-48 w-full bg-slate-950 overflow-hidden">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={evt.posterUrl}
                        alt={evt.title}
                        className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/30 to-transparent" />

                      {/* Category Badge */}
                      <div className="absolute top-3 left-3">
                        <Badge className="bg-slate-950/80 backdrop-blur-md text-white border-0 text-[10px] font-bold">
                          {evt.category}
                        </Badge>
                      </div>

                      {/* Pricing Tag */}
                      <div className="absolute top-3 right-3">
                        <span
                          className={`text-[10px] font-black px-2.5 py-1 rounded-full shadow-xs backdrop-blur-md ${
                            evt.isPaid
                              ? "bg-slate-900/90 text-emerald-400 border border-emerald-500/30"
                              : "bg-[#3B7A57]/90 text-white"
                          }`}
                        >
                          {evt.isPaid ? formatCurrencyIDR(evt.price) : "GRATIS"}
                        </span>
                      </div>

                      {/* Organizer */}
                      <div className="absolute bottom-2.5 left-3 text-[11px] font-medium text-slate-200">
                        Oleh: <span className="font-bold text-white">{evt.organizerName}</span>
                      </div>
                    </div>

                    {/* Card Content */}
                    <div className="p-6 space-y-3">
                      <h3 className="font-bold text-base text-slate-900 dark:text-white line-clamp-2 leading-snug group-hover:text-[#3B7A57] dark:group-hover:text-emerald-400 transition-colors">
                        {evt.title}
                      </h3>

                      <p className="text-xs text-slate-600 dark:text-slate-400 line-clamp-2 leading-relaxed">
                        {evt.description}
                      </p>

                      <div className="pt-2 space-y-1.5 text-xs text-slate-600 dark:text-slate-300 border-t border-slate-200 dark:border-white/10">
                        <div className="flex items-center space-x-2">
                          <Calendar className="w-3.5 h-3.5 text-[#3B7A57] dark:text-emerald-400 flex-shrink-0" />
                          <span className="truncate">
                            {new Date(evt.startDate).toLocaleDateString("id-ID", {
                              weekday: "short",
                              day: "numeric",
                              month: "short",
                              year: "numeric",
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </span>
                        </div>
                        <div className="flex items-center space-x-2 text-slate-500 dark:text-slate-400 text-[11px]">
                          <MapPin className="w-3.5 h-3.5 flex-shrink-0 text-slate-400 dark:text-slate-500" />
                          <span className="truncate">{evt.location}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Card Action */}
                  <div className="p-6 pt-0">
                    <Link href={`/events/${evt.id}`}>
                      <Button
                        variant="outline"
                        className="w-full text-xs font-bold border-slate-300 dark:border-white/15 text-slate-700 dark:text-slate-200 hover:bg-[#3B7A57] hover:text-white hover:border-[#3B7A57] rounded-xl justify-between transition-all group/btn"
                      >
                        <span>Lihat Detail Event</span>
                        <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover/btn:translate-x-1" />
                      </Button>
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}

        </div>
      </section>

      {/* 5. SECTION: TENTANG DAGO (EKOSISTEM TERPADU OPERASIONAL) */}
      <section id="about" className="py-24 bg-slate-100/70 dark:bg-[#0E131F] transition-colors duration-300 relative scroll-mt-20 border-t border-slate-200 dark:border-white/5">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">

            {/* Left Visual */}
            <div className="lg:col-span-6 relative space-y-4">
              <div className="relative rounded-3xl overflow-hidden shadow-2xl border border-slate-200 dark:border-white/10 aspect-[4/3] group">
                <Image
                  src="https://images.unsplash.com/photo-1527192491265-7e15c55b1ed2?q=80&w=1200&auto=format&fit=crop"
                  alt="Dago Creative Hub Workspace"
                  fill
                  unoptimized
                  className="object-cover transition-transform duration-700 group-hover:scale-105"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-slate-950/90 via-slate-950/30 to-transparent" />

                <div className="absolute bottom-6 left-6 right-6 text-white space-y-1.5">
                  <Badge className="bg-[#3B7A57] text-white text-[10px] font-bold uppercase tracking-wider">
                    Integrated Ecosystem
                  </Badge>
                  <h3 className="font-black text-xl text-white">DAGO Creative Hub Bali</h3>
                  <p className="text-xs text-slate-300 leading-relaxed">
                    Sinergi operasional F&B modern, ruang kerja bersama, dan program keanggotaan loyalty dalam satu sistem.
                  </p>
                </div>
              </div>

              {/* Authentic Feature Pillars Bar (Replacing fabricated stats) */}
              <div className="grid grid-cols-3 gap-3">
                <div className="p-4 rounded-2xl bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 text-center shadow-xs">
                  <span className="text-sm sm:text-base font-black text-[#3B7A57] dark:text-[#52B788] block">
                    Multi-Mitra
                  </span>
                  <span className="text-[10px] text-slate-500 dark:text-slate-400 font-bold uppercase">Kuliner Terpadu</span>
                </div>
                <div className="p-4 rounded-2xl bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 text-center shadow-xs">
                  <span className="text-sm sm:text-base font-black text-emerald-600 dark:text-emerald-400 block">
                    QR Meja
                  </span>
                  <span className="text-[10px] text-slate-500 dark:text-slate-400 font-bold uppercase">Self-Order KDS</span>
                </div>
                <div className="p-4 rounded-2xl bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 text-center shadow-xs">
                  <span className="text-sm sm:text-base font-black text-[#3B7A57] dark:text-[#52B788] block">
                    Workspace
                  </span>
                  <span className="text-[10px] text-slate-500 dark:text-slate-400 font-bold uppercase">Meeting & Pod</span>
                </div>
              </div>
            </div>

            {/* Right Content */}
            <div className="lg:col-span-6 space-y-6">
              <div className="space-y-2">
                <Badge variant="outline" className="text-[#3B7A57] dark:text-[#52B788] border-[#3B7A57]/30 dark:border-[#52B788]/40 bg-[#3B7A57]/10 dark:bg-[#52B788]/10 font-black uppercase text-[10px] tracking-wider">
                  Tentang DAGO Creative Hub
                </Badge>
                <h2 className="text-2xl sm:text-4xl font-black text-slate-900 dark:text-white tracking-tight leading-tight">
                  Ekosistem Terintegrasi untuk Produktivitas & Kuliner
                </h2>
                <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 leading-relaxed pt-1">
                  DAGO Creative Hub menghadirkan platform terpadu yang menghubungkan pengunjung, kasir POS terintegrasi, stasiun dapur KDS, reservasi workspace, dan program loyalty dalam satu alur yang nyaman.
                </p>
              </div>

              <div className="space-y-3 pt-2">
                {[
                  {
                    title: "Pemesanan Mandiri & Smart Kitchen Display",
                    desc: "Tamu memesan langsung via scan QR Meja, pesanan otomatis didistribusikan ke stasiun dapur (KDS) mitra terkait.",
                  },
                  {
                    title: "Ruang Kerja & Meeting Room Fleksibel",
                    desc: "Pilihan Hot Desk harian hingga VIP Meeting Room dengan koneksi internet dedicated dan fasilitas representatif.",
                  },
                  {
                    title: "Loyalty Points & Program Member",
                    desc: "Setiap transaksi F&B dan Co-Working menambah poin pelanggan secara otomatis untuk ditukar dengan reward.",
                  },
                ].map((item, idx) => (
                  <div
                    key={idx}
                    className="flex items-start space-x-3.5 p-4 rounded-2xl bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 hover:border-[#52B788]/50 hover:bg-slate-50 dark:hover:bg-white/10 transition-all duration-200 shadow-xs"
                  >
                    <div className="w-7 h-7 rounded-xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <Check className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="font-bold text-xs text-slate-900 dark:text-white">{item.title}</h4>
                      <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-relaxed mt-0.5">{item.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* 6. SECTION: RINGKASAN LOYALTY REWARDS */}
      <section id="loyalty" className="py-16 bg-slate-100/70 dark:bg-[#0B0F17] transition-colors duration-300 relative overflow-hidden border-t border-slate-200 dark:border-white/5">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="p-8 sm:p-10 rounded-3xl bg-gradient-to-r from-emerald-50 via-white to-emerald-50/40 dark:from-emerald-950/40 dark:via-slate-900 dark:to-slate-900 border border-[#52B788]/30 flex flex-col md:flex-row items-center justify-between gap-6 shadow-xl transition-colors">
            <div className="space-y-1.5 text-center md:text-left">
              <div className="flex items-center justify-center md:justify-start space-x-2">
                <Crown className="w-4 h-4 text-[#3B7A57] dark:text-[#52B788]" />
                <span className="text-[10px] font-black uppercase tracking-wider text-[#3B7A57] dark:text-[#52B788]">
                  DAGO Member Loyalty Program
                </span>
              </div>
              <h3 className="font-black text-xl sm:text-2xl text-slate-900 dark:text-white">Kumpulkan Poin Setiap Transaksi</h3>
              <p className="text-xs text-slate-600 dark:text-slate-300 max-w-xl">
                Nikmati diskon eksklusif, free jam coworking, dan voucher reward spesial untuk setiap transaksi F&B dan Co-Working di DAGO Creative Hub.
              </p>
            </div>
            <Link href="/customer?tab=LOYALTY">
              <Button size="lg" className="h-12 px-7 font-bold bg-[#3B7A57] text-white hover:bg-[#2E6044] rounded-2xl text-xs shadow-lg shadow-[#3B7A57]/20 whitespace-nowrap transition-all hover:scale-105 active:scale-95 border border-[#52B788]/30">
                <span>Eksplor Program Member</span>
                <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* 7. SECTION: KONTAK & FOOTER */}
      <footer id="contact" className="py-20 bg-slate-950 text-slate-300 border-t border-slate-800 relative scroll-mt-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8 pb-12 border-b border-white/10">

            {/* Col 1: Brand Info */}
            <div className="space-y-3">
              <div className="flex items-center space-x-2.5">
                <div className="w-8 h-10 relative flex-shrink-0">
                  <Image src="/logo-dago.png" alt="Logo" width={32} height={40} className="object-contain" />
                </div>
                <span className="font-black text-base text-white">DagoEng Creative Hub</span>
              </div>
              <p className="text-xs text-slate-400 leading-relaxed">
                Ekosistem terpadu F&B kuliner artisan, Co-working space representatif, dan program customer loyalty modern di Bali.
              </p>
            </div>

            {/* Col 2: Kontak & Alamat Resmi */}
            <div className="space-y-2.5 text-xs">
              <h4 className="font-bold text-white uppercase tracking-wider text-xs">Lokasi & Kontak</h4>
              <div className="flex items-start space-x-2 text-slate-400">
                <MapPin className="w-4 h-4 text-[#52B788] flex-shrink-0 mt-0.5" />
                <span>Jl. Ngurah Rai No. 45, Singaraja, Kabupaten Buleleng, Bali 81116</span>
              </div>
              <div className="flex items-center space-x-2 text-slate-400">
                <Clock className="w-4 h-4 text-[#52B788] flex-shrink-0" />
                <span>08:00 - 22:00 WITA (Buka Setiap Hari)</span>
              </div>
              <div className="flex items-center space-x-2 text-slate-400">
                <Phone className="w-4 h-4 text-[#52B788] flex-shrink-0" />
                <span>+62 811-2233-4455</span>
              </div>
              <div className="flex items-center space-x-2 text-slate-400">
                <Mail className="w-4 h-4 text-[#52B788] flex-shrink-0" />
                <span>info@dagoeng.com</span>
              </div>
            </div>

            {/* Col 3: Media Sosial Resmi */}
            <div className="space-y-2.5 text-xs">
              <h4 className="font-bold text-white uppercase tracking-wider text-xs">Media Sosial Resmi</h4>
              <p className="text-slate-400 text-[11px]">Ikuti update promo, menu baru, dan event DAGO Creative Hub:</p>
              <div className="flex flex-wrap gap-2 pt-1">
                <a
                  href="https://instagram.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-white/5 border border-white/10 hover:border-[#52B788] hover:bg-white/10 text-slate-200 transition-colors"
                >
                  <Instagram className="w-3.5 h-3.5 text-pink-400" />
                  <span>@dagocreativehub</span>
                </a>
                <a
                  href="https://wa.me/6281122334455"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-white/5 border border-white/10 hover:border-[#52B788] hover:bg-white/10 text-slate-200 transition-colors"
                >
                  <MessageCircle className="w-3.5 h-3.5 text-emerald-400" />
                  <span>WhatsApp CS</span>
                </a>
              </div>
            </div>

            {/* Col 4: Quick Direct Links */}
            <div className="space-y-2 text-xs">
              <h4 className="font-bold text-white uppercase tracking-wider text-xs">Navigasi Langsung</h4>
              <div className="flex flex-col space-y-1.5 text-slate-400">
                <Link href="/customer?tab=MENU" className="hover:text-[#52B788] transition-colors">Layanan Kuliner (F&B)</Link>
                <Link href="/customer?tab=COWORKING" className="hover:text-[#52B788] transition-colors">Layanan Co-Working Space</Link>
                <Link href="/customer?tab=LOYALTY" className="hover:text-[#52B788] transition-colors">Program Member Loyalty</Link>
                <Link href="/events" className="hover:text-[#52B788] transition-colors">Event Komunitas</Link>
                <button onClick={() => setIsLoginModalOpen(true)} className="text-left hover:text-[#52B788] transition-colors cursor-pointer">
                  Akses Staf & Manajemen
                </button>
              </div>
            </div>

          </div>

          {/* Bottom Copyright */}
          <div className="pt-6 flex flex-col sm:flex-row items-center justify-between text-[11px] text-slate-500 gap-2">
            <span>© {new Date().getFullYear()} DagoEng Creative Hub. Hak Cipta Dilindungi.</span>
            <div className="flex items-center space-x-4">
              <span>Satu Ekosistem F&B & Coworking</span>
              <span className="font-mono text-slate-600">v2.5 Enterprise</span>
            </div>
          </div>
        </div>
      </footer>

      {/* 8. INTERACTIVE LOGIN MODAL POPUP */}
      {isLoginModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="fixed inset-0 bg-slate-950/80 backdrop-blur-md transition-opacity animate-in fade-in"
            onClick={() => setIsLoginModalOpen(false)}
          />

          <div className="relative w-full max-w-md bg-white dark:bg-[#131B2B] border border-slate-200 dark:border-white/15 rounded-3xl p-6 sm:p-7 shadow-2xl z-10 text-slate-900 dark:text-white space-y-5 animate-in zoom-in-95 duration-200 transition-colors">

            {/* Modal Header */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-white/10">
              <div className="flex items-center space-x-2.5">
                <div className="w-8 h-8 rounded-xl bg-[#3B7A57]/10 dark:bg-[#52B788]/20 text-[#3B7A57] dark:text-[#52B788] flex items-center justify-center font-bold">
                  <LogIn className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-black text-base text-slate-900 dark:text-white">Masuk ke Sistem DagoEng</h3>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">Pilih akses cepat role untuk demo atau form login</p>
                </div>
              </div>
              <button
                onClick={() => setIsLoginModalOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/10 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Quick 1-Click Role Access Grid */}
            <div className="space-y-2">
              <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">
                Akses Langsung 1-Klik Role:
              </span>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <button
                  onClick={() => handleQuickModalLogin("DAGO_OWNER")}
                  className="p-2.5 rounded-xl bg-slate-50 dark:bg-white/5 hover:bg-[#3B7A57] hover:text-white border border-slate-200 dark:border-white/10 text-left transition-all group shadow-2xs cursor-pointer"
                >
                  <span className="block font-bold text-slate-800 dark:text-white group-hover:text-white">Owner Dago Hub</span>
                  <span className="text-[10px] text-slate-500 dark:text-slate-400 group-hover:text-white/80">Executive Org</span>
                </button>

                <button
                  onClick={() => handleQuickModalLogin("TENANT_OWNER_KS")}
                  className="p-2.5 rounded-xl bg-slate-50 dark:bg-white/5 hover:bg-[#3B7A57] hover:text-white border border-slate-200 dark:border-white/10 text-left transition-all group shadow-2xs cursor-pointer"
                >
                  <span className="block font-bold text-slate-800 dark:text-white group-hover:text-white">Owner Kopi Senja</span>
                  <span className="text-[10px] text-slate-500 dark:text-slate-400 group-hover:text-white/80">Tenant F&B</span>
                </button>

                <button
                  onClick={() => handleQuickModalLogin("CASHIER_SGR")}
                  className="p-2.5 rounded-xl bg-slate-50 dark:bg-white/5 hover:bg-[#3B7A57] hover:text-white border border-slate-200 dark:border-white/10 text-left transition-all group shadow-2xs cursor-pointer"
                >
                  <span className="block font-bold text-slate-800 dark:text-white group-hover:text-white">Kasir POS</span>
                  <span className="text-[10px] text-slate-500 dark:text-slate-400 group-hover:text-white/80">Singaraja POS</span>
                </button>

                <button
                  onClick={() => handleQuickModalLogin("KITCHEN_SGR")}
                  className="p-2.5 rounded-xl bg-slate-50 dark:bg-white/5 hover:bg-[#3B7A57] hover:text-white border border-slate-200 dark:border-white/10 text-left transition-all group shadow-2xs cursor-pointer"
                >
                  <span className="block font-bold text-slate-800 dark:text-white group-hover:text-white">Chef Dapur (KDS)</span>
                  <span className="text-[10px] text-slate-500 dark:text-slate-400 group-hover:text-white/80">Antrean Dapur</span>
                </button>

                <button
                  onClick={() => handleQuickModalLogin("WAITER_SGR")}
                  className="p-2.5 rounded-xl bg-slate-50 dark:bg-white/5 hover:bg-[#3B7A57] hover:text-white border border-slate-200 dark:border-white/10 text-left transition-all group shadow-2xs cursor-pointer"
                >
                  <span className="block font-bold text-slate-800 dark:text-white group-hover:text-white">Pramusaji / Waiter</span>
                  <span className="text-[10px] text-slate-500 dark:text-slate-400 group-hover:text-white/80">Denah Meja</span>
                </button>

                <button
                  onClick={() => handleQuickModalLogin("CUSTOMER_DEMO")}
                  className="p-2.5 rounded-xl bg-slate-50 dark:bg-white/5 hover:bg-[#3B7A57] hover:text-white border border-slate-200 dark:border-white/10 text-left transition-all group shadow-2xs cursor-pointer"
                >
                  <span className="block font-bold text-slate-800 dark:text-white group-hover:text-white">Pelanggan QR</span>
                  <span className="text-[10px] text-slate-500 dark:text-slate-400 group-hover:text-white/80">Customer Portal</span>
                </button>
              </div>
            </div>

            {/* Link to Full Login Form */}
            <div className="pt-2 border-t border-slate-200 dark:border-white/10 flex items-center justify-between text-xs">
              <Link
                href="/login"
                onClick={() => setIsLoginModalOpen(false)}
                className="text-[#3B7A57] dark:text-[#52B788] font-bold hover:underline flex items-center space-x-1"
              >
                <span>Buka Form Login Email Lengkap</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}

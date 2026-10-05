"use client";

import React, { useState, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth, PersonaKey } from "@/contexts/AuthContext";
import { useOutlet } from "@/contexts/OutletContext";
import { formatCurrencyIDR } from "@/lib/utils";
import { AnimatedCounter } from "@/components/ui/animated-counter";
import {
  UtensilsCrossed,
  Laptop,
  Store,
  ArrowRight,
  Sparkles,
  CheckCircle2,
  Clock,
  MapPin,
  Wifi,
  ChevronRight,
  LogIn,
  Phone,
  Search,
  Users,
  Coffee,
  Check,
  Building2,
  Crown,
  Star,
  Menu,
  X,
  Mail,
  Instagram,
  MessageCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";

// Hero Slides Data
const HERO_SLIDES = [
  {
    id: 1,
    title: "Sajian Kuliner Artisan & Kopi Spesialti",
    subtitle: "Nikmati aneka seduhan kopi lokal pilihan dan hidangan kuliner premium multi-mitra dengan pemesanan mandiri cepat via QR Meja.",
    badge: "Layanan F&B DAGO",
    bgImage: "https://images.unsplash.com/photo-1501339847302-ac426a4a7cbb?q=80&w=1920&auto=format&fit=crop",
    ctaFnb: "Explore F&B",
    ctaCowork: "Explore Co-Working",
  },
  {
    id: 2,
    title: "Ruang Kerja Kolaboratif & Meeting Suite",
    subtitle: "Hot desk fleksibel, dedicated nomad desk, dan meeting room privat kedap suara dengan koneksi fiber optic dedicated 100 Mbps.",
    badge: "Layanan Co-Working DAGO",
    bgImage: "https://images.unsplash.com/photo-1497366216548-37526070297c?q=80&w=1920&auto=format&fit=crop",
    ctaFnb: "Explore F&B",
    ctaCowork: "Explore Co-Working",
  },
  {
    id: 3,
    title: "Satu Ekosistem Terpadu Produktivitas & Rasa",
    subtitle: "DAGO Creative Hub memadukan kenyamanan bekerja, pilihan kuliner artisan, dan program membership loyalty dalam satu platform.",
    badge: "DAGO Creative Hub Bali",
    bgImage: "https://images.unsplash.com/photo-1527192491265-7e15c55b1ed2?q=80&w=1920&auto=format&fit=crop",
    ctaFnb: "Explore F&B",
    ctaCowork: "Explore Co-Working",
  },
];

export default function PublicLandingPage() {
  const router = useRouter();
  const { user, login } = useAuth();
  const { outlets } = useOutlet();

  // Scroll State for Navbar Glassmorphism & Active Spy
  const [isScrolled, setIsScrolled] = useState(false);
  const [activeSection, setActiveSection] = useState("");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);

  // Hero Carousel State (Snappy 3-second transition)
  const [currentSlide, setCurrentSlide] = useState(0);

  // Quick Service Finder State
  const [selectedOutlet, setSelectedOutlet] = useState("outlet-sgr");
  const [selectedService, setSelectedService] = useState("MENU");

  // Scroll detection & Active Section Spy
  useEffect(() => {
    const handleScroll = () => {
      const scrollPos = window.scrollY;
      setIsScrolled(scrollPos > 20);

      const sectionIds = ["about", "services", "outlets", "contact"];
      let current = "";
      for (const id of sectionIds) {
        const el = document.getElementById(id);
        if (el) {
          const top = el.offsetTop - 140;
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
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // Auto-advance hero carousel
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % HERO_SLIDES.length);
    }, 3500);
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

  const handleOpenService = () => {
    router.push(`/customer?tab=${selectedService}&outlet=${selectedOutlet}`);
  };

  const scrollToSection = (id: string) => {
    const el = document.getElementById(id);
    if (el) {
      const navbarOffset = 80;
      const elementPosition = el.getBoundingClientRect().top;
      const offsetPosition = elementPosition + window.pageYOffset - navbarOffset;
      window.scrollTo({
        top: offsetPosition,
        behavior: "smooth",
      });
      setActiveSection(id);
    }
  };

  return (
    <div className="min-h-screen bg-[#0B0F17] text-slate-100 font-sans flex flex-col justify-between selection:bg-brand-orange selection:text-white scroll-smooth overflow-x-hidden">

      {/* 1. CLEAN & SPACIOUS GLASSMORPHISM NAVBAR */}
      <header
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-500 ease-in-out animate-in fade-in slide-in-from-top-3 ${isScrolled
          ? "bg-slate-950/80 backdrop-blur-2xl shadow-lg shadow-black/30 py-3"
          : "bg-transparent py-4 sm:py-5"
          }`}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between">

          {/* Brand Logo & Name */}
          <Link href="/" className="flex items-center space-x-3 group relative">
            <div className="relative flex-shrink-0">
              <div className="absolute -inset-1 rounded-full bg-brand-orange/30 blur-md opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />
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
              <span className="font-black text-lg tracking-tight text-white block leading-none drop-shadow-sm transition-colors duration-200 group-hover:text-slate-100">
                DagoEng <span className="text-brand-orange transition-all duration-300 group-hover:text-orange-400">Creative Hub</span>
              </span>
              <span className="text-[10px] font-bold text-slate-400 tracking-wider uppercase transition-colors duration-200 group-hover:text-slate-300">
                F&B Management & Coworking
              </span>
            </div>
          </Link>

          {/* Clean Desktop Nav Links */}
          <nav className="hidden lg:flex items-center space-x-1.5 p-1.5 rounded-full bg-white/5 backdrop-blur-md border border-white/10 text-xs font-semibold text-slate-300">
            {[
              { id: "about", label: "Tentang" },
              { id: "services", label: "Layanan" },
              { id: "outlets", label: "Cabang" },
              { id: "contact", label: "Kontak" },
            ].map((item) => {
              const isActive = activeSection === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => scrollToSection(item.id)}
                  className={`px-4 py-2 rounded-full transition-all duration-300 ease-out relative ${isActive
                    ? "bg-gradient-to-r from-brand-orange to-orange-500 text-white shadow-md shadow-orange-500/30 font-bold scale-[1.03]"
                    : "text-slate-300 hover:text-white hover:bg-white/10 active:scale-95"
                    }`}
                >
                  {item.label}
                </button>
              );
            })}
          </nav>

          {/* Action Buttons */}
          <div className="hidden sm:flex items-center space-x-3">
            <Link href="/customer">
              <Button
                size="sm"
                className="text-xs h-10 px-5 font-black bg-brand-orange text-white hover:bg-orange-600 shadow-lg shadow-orange-500/25 rounded-xl transition-all duration-300 hover:scale-105 hover:shadow-orange-500/40 active:scale-95 border border-orange-400/40 group"
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
              className="text-xs h-10 px-4 font-bold bg-white/5 backdrop-blur-md border-white/20 text-slate-200 hover:bg-white/15 hover:text-white hover:border-white/40 rounded-xl transition-all duration-300 hover:scale-105 active:scale-95 group"
            >
              <LogIn className="w-3.5 h-3.5 mr-1.5 text-brand-orange transition-transform duration-300 group-hover:translate-x-0.5" />
              <span>{user ? `Akun: ${user.name.split(" ")[0]}` : "Masuk Sistem"}</span>
            </Button>
          </div>

          {/* Mobile Menu Toggle Button */}
          <div className="flex sm:hidden items-center space-x-2">
            <Link href="/customer">
              <Button size="sm" className="text-[11px] h-8 px-3 font-bold bg-brand-orange text-white rounded-lg shadow-sm hover:scale-105 active:scale-95 transition-all">
                Portal
              </Button>
            </Link>
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 rounded-xl bg-white/10 text-white hover:bg-white/20 active:scale-90 transition-all duration-200"
              aria-label="Toggle Menu"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>

        </div>

        {/* Mobile Dropdown Menu with Slide Animation */}
        {mobileMenuOpen && (
          <div className="sm:hidden px-4 pt-3 pb-6 bg-slate-950/95 backdrop-blur-2xl border-b border-white/10 space-y-3 animate-in fade-in slide-in-from-top-3 duration-300">
            <div className="flex flex-col space-y-1.5 text-sm font-semibold text-slate-300">
              {[
                { id: "about", label: "Tentang" },
                { id: "services", label: "Layanan (F&B & Coworking)" },
                { id: "outlets", label: "Cabang Outlet" },
                { id: "contact", label: "Kontak & Medsos" },
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
                      ? "bg-brand-orange text-white font-bold shadow-sm shadow-orange-500/20"
                      : "hover:bg-white/5 hover:text-white"
                      }`}
                  >
                    {item.label}
                  </button>
                );
              })}
            </div>

            <div className="pt-3 border-t border-white/10 flex flex-col gap-2">
              <Link href="/customer" onClick={() => setMobileMenuOpen(false)}>
                <Button className="w-full bg-brand-orange text-white font-bold text-xs h-10 rounded-xl hover:scale-[1.02] active:scale-95 transition-all">
                  Buka Customer Portal
                </Button>
              </Link>
              <Button
                onClick={() => {
                  setMobileMenuOpen(false);
                  setIsLoginModalOpen(true);
                }}
                variant="outline"
                className="w-full bg-white/5 text-slate-200 border-white/20 font-bold text-xs h-10 rounded-xl hover:scale-[1.02] active:scale-95 transition-all"
              >
                Masuk / Login Multi-Role
              </Button>
            </div>
          </div>
        )}
      </header>

      {/* 2. HERO SLIDESHOW (INTRODUCE & DIRECT) */}
      <section className="relative min-h-[600px] sm:min-h-[660px] lg:min-h-[720px] flex items-center justify-center overflow-hidden bg-slate-950 text-white pt-24 sm:pt-28">
        {HERO_SLIDES.map((slide, idx) => (
          <div
            key={slide.id}
            className={`absolute inset-0 transition-all duration-700 ease-out ${idx === currentSlide
              ? "opacity-100 scale-100"
              : "opacity-0 scale-105 pointer-events-none"
              }`}
          >
            <div
              className="absolute inset-0 bg-cover bg-center transition-transform duration-[3500ms] ease-linear"
              style={{ backgroundImage: `url(${slide.bgImage})` }}
            />
            <div className="absolute inset-0 bg-gradient-to-t from-[#0B0F17] via-slate-950/75 to-slate-950/60" />
            <div className="absolute inset-0 bg-radial-gradient from-transparent via-slate-950/40 to-[#0B0F17]" />
          </div>
        ))}

        {/* Ambient Glow Aura */}
        <div className="absolute top-1/3 left-1/4 w-96 h-96 bg-brand-orange/20 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-blue-600/15 rounded-full blur-3xl pointer-events-none" />

        {/* Hero Content Container */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14 relative z-20 w-full">
          <div className="max-w-3xl space-y-6">

            {/* Glowing Badge */}
            <div className="inline-flex items-center space-x-2 bg-brand-orange/20 backdrop-blur-md border border-brand-orange/50 text-orange-400 px-4 py-1.5 rounded-full text-xs font-black uppercase tracking-wider shadow-lg shadow-orange-500/10 animate-in fade-in duration-300">
              <Sparkles className="w-3.5 h-3.5 text-brand-orange animate-spin" style={{ animationDuration: "6s" }} />
              <span>{HERO_SLIDES[currentSlide].badge}</span>
            </div>

            {/* Slide Title */}
            <h1 className="text-3xl sm:text-5xl lg:text-6xl font-black text-white tracking-tight leading-[1.12] drop-shadow-md">
              {HERO_SLIDES[currentSlide].title}
            </h1>

            {/* Slide Subtitle */}
            <p className="text-sm sm:text-base text-slate-200 leading-relaxed max-w-2xl font-normal drop-shadow-sm">
              {HERO_SLIDES[currentSlide].subtitle}
            </p>

            {/* Dual Core CTA Buttons (Direct to F&B and Co-Working) */}
            <div className="pt-2 flex flex-wrap items-center gap-3.5">
              <Link href="/customer?tab=MENU">
                <Button
                  size="lg"
                  className="h-12 px-7 font-black bg-brand-orange text-white hover:bg-orange-600 rounded-2xl text-xs shadow-xl shadow-orange-500/25 transition-all hover:scale-105 active:scale-95 border border-orange-400/40 flex items-center space-x-2"
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
                  className="h-12 px-7 font-bold bg-white/10 backdrop-blur-md border-white/20 text-white hover:bg-white/20 rounded-2xl text-xs transition-all hover:scale-105 active:scale-95 flex items-center space-x-2"
                >
                  <Laptop className="w-4 h-4 text-brand-orange" />
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
                    ? "w-10 bg-brand-orange shadow-md shadow-orange-500/50"
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

      {/* 3. QUICK SERVICE FINDER BAR (DIRECT) */}
      <section className="relative z-30 -mt-10 sm:-mt-12 max-w-6xl mx-auto px-4 sm:px-6 w-full">
        <div className="bg-slate-900/95 backdrop-blur-xl rounded-3xl p-4 sm:p-5 shadow-2xl border border-white/15 flex flex-col md:flex-row items-center justify-between gap-4 text-white">

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full md:w-auto flex-1">
            {/* Select Location */}
            <div className="flex items-center space-x-3 p-3 rounded-2xl bg-white/5 border border-white/10 hover:border-brand-orange/50 transition-colors">
              <MapPin className="w-5 h-5 text-brand-orange flex-shrink-0" />
              <div className="space-y-0.5 flex-1">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                  Pilih Cabang Dago
                </span>
                <select
                  value={selectedOutlet}
                  onChange={(e) => setSelectedOutlet(e.target.value)}
                  className="bg-transparent text-xs font-bold text-white outline-none w-full cursor-pointer"
                >
                  {outlets.map((o) => (
                    <option
                      key={o.id}
                      value={o.id}
                      disabled={o.isComingSoon}
                      className={o.isComingSoon ? "bg-slate-900 text-slate-400 italic" : "bg-slate-900 text-white font-bold"}
                    >
                      {o.name} {o.isComingSoon ? "— ⏳ (Segera Hadir)" : `(${o.address})`}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Select Service Type */}
            <div className="flex items-center space-x-3 p-3 rounded-2xl bg-white/5 border border-white/10 hover:border-brand-orange/50 transition-colors">
              <Building2 className="w-5 h-5 text-blue-400 flex-shrink-0" />
              <div className="space-y-0.5 flex-1">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                  Layanan Yang Dituju
                </span>
                <select
                  value={selectedService}
                  onChange={(e) => setSelectedService(e.target.value)}
                  className="bg-transparent text-xs font-bold text-white outline-none w-full cursor-pointer"
                >
                  <option value="MENU" className="bg-slate-900 text-white">🍽️ Layanan F&B (Menu & Kopi)</option>
                  <option value="COWORKING" className="bg-slate-900 text-white">💻 Layanan Co-Working (Workspace & Meeting)</option>
                  <option value="LOYALTY" className="bg-slate-900 text-white">🎁 Program Member Loyalty</option>
                </select>
              </div>
            </div>
          </div>

          {/* Action Search Button */}
          <Button
            onClick={handleOpenService}
            className="w-full md:w-auto h-12 px-7 font-black bg-brand-orange text-white hover:bg-orange-600 rounded-2xl text-xs transition-all hover:scale-105 active:scale-95 shadow-lg shadow-orange-500/25"
          >
            <Search className="w-4 h-4 mr-2" />
            <span>Buka Layanan di Customer Portal</span>
          </Button>
        </div>
      </section>

      {/* 4. SECTION: LAYANAN UTAMA DAGO (INFORM & DIRECT: F&B & COWORKING) */}
      <section id="services" className="py-24 bg-[#0B0F17] relative">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">

          <div className="text-center max-w-2xl mx-auto space-y-2">
            <Badge variant="outline" className="text-brand-orange border-brand-orange/40 bg-brand-orange/10 font-black uppercase text-[10px] tracking-wider">
              Dua Layanan Utama DAGO
            </Badge>
            <h2 className="text-2xl sm:text-4xl font-black text-white tracking-tight">
              Satu Ekosistem, Dua Pengalaman Layanan
            </h2>
            <p className="text-xs sm:text-sm text-slate-400">
              Jelajahi sajian kuliner artisan F&B pilihan atau pesan ruang kerja Co-Working representatif sesuai kebutuhan Anda.
            </p>
          </div>

          {/* 2 Core Service Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">

            {/* Service 1: F&B & Culinary */}
            <div className="p-8 rounded-3xl bg-slate-900/80 border border-white/10 space-y-6 flex flex-col justify-between hover:border-brand-orange hover:bg-gradient-to-b hover:from-orange-950/30 hover:via-slate-900 hover:to-slate-900 transition-all duration-300 shadow-xl group">
              <div className="space-y-4">
                <div className="w-12 h-12 rounded-2xl bg-brand-orange/20 text-brand-orange border border-brand-orange/30 flex items-center justify-center font-bold">
                  <UtensilsCrossed className="w-6 h-6" />
                </div>
                <div>
                  <Badge className="bg-brand-orange/20 text-orange-400 border border-brand-orange/30 text-[10px] font-bold uppercase mb-2">
                    Layanan F&B
                  </Badge>
                  <h3 className="text-2xl font-black text-white group-hover:text-brand-orange transition-colors">
                    Sajian Kuliner Artisan & Kopi
                  </h3>
                  <p className="text-xs sm:text-sm text-slate-300 leading-relaxed mt-2">
                    Koleksi menu lezat dari aneka mitra kuliner DAGO — mulai dari specialty coffee Kopi Senja, masakan lezat Dapur Mama, Manis Bakery, hingga Warung Bu Narti. Pesan mandiri via QR Meja dengan pembayaran instan.
                  </p>
                </div>

                <div className="pt-2 space-y-2 text-xs text-slate-300">
                  <div className="flex items-center space-x-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                    <span>Multi-Mitra Kuliner Terintegrasi</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                    <span>Pemesanan Mandiri Cepat Tanpa Antre</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                    <span>Nota Transaksi F&B Resmi & Riwayat Order</span>
                  </div>
                </div>
              </div>

              <div className="pt-6 border-t border-white/10">
                <Link href="/customer?tab=MENU">
                  <Button className="w-full h-12 bg-brand-orange hover:bg-orange-600 text-white font-black text-xs rounded-2xl shadow-lg shadow-orange-500/25 transition-all hover:scale-[1.02] active:scale-95 flex items-center justify-center space-x-2">
                    <span>Explore F&B</span>
                    <ArrowRight className="w-4 h-4" />
                  </Button>
                </Link>
              </div>
            </div>

            {/* Service 2: Co-Working & Workspace */}
            <div className="p-8 rounded-3xl bg-slate-900/80 border border-white/10 space-y-6 flex flex-col justify-between hover:border-blue-500 hover:bg-gradient-to-b hover:from-blue-950/30 hover:via-slate-900 hover:to-slate-900 transition-all duration-300 shadow-xl group">
              <div className="space-y-4">
                <div className="w-12 h-12 rounded-2xl bg-blue-500/20 text-blue-400 border border-blue-500/30 flex items-center justify-center font-bold">
                  <Laptop className="w-6 h-6" />
                </div>
                <div>
                  <Badge className="bg-blue-500/20 text-blue-300 border border-blue-500/30 text-[10px] font-bold uppercase mb-2">
                    Layanan Co-Working
                  </Badge>
                  <h3 className="text-2xl font-black text-white group-hover:text-blue-400 transition-colors">
                    Ruang Kerja & Meeting Room
                  </h3>
                  <p className="text-xs sm:text-sm text-slate-300 leading-relaxed mt-2">
                    Pilihan Hot Desk fleksibel, Dedicated Nomad Desk, dan VIP Meeting Suite ber-AC dengan koneksi fiber optic dedicated 100 Mbps serta fasilitas free flow kopi/teh artisan.
                  </p>
                </div>

                <div className="pt-2 space-y-2 text-xs text-slate-300">
                  <div className="flex items-center space-x-2">
                    <CheckCircle2 className="w-4 h-4 text-blue-400 flex-shrink-0" />
                    <span>WiFi Dedicated 100 Mbps Berkecepatan Tinggi</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <CheckCircle2 className="w-4 h-4 text-blue-400 flex-shrink-0" />
                    <span>Reservasi Fleksibel Jam atau Bulanan</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <CheckCircle2 className="w-4 h-4 text-blue-400 flex-shrink-0" />
                    <span>Nota Transaksi Co-Working & Booking Terpisah</span>
                  </div>
                </div>
              </div>

              <div className="pt-6 border-t border-white/10">
                <Link href="/customer?tab=COWORKING">
                  <Button className="w-full h-12 bg-blue-600 hover:bg-blue-700 text-white font-black text-xs rounded-2xl shadow-lg shadow-blue-500/25 transition-all hover:scale-[1.02] active:scale-95 flex items-center justify-center space-x-2">
                    <span>Explore Co-Working</span>
                    <ArrowRight className="w-4 h-4" />
                  </Button>
                </Link>
              </div>
            </div>

          </div>

        </div>
      </section>

      {/* 5. SECTION: TENTANG DAGO (INFORM: EKOSISTEM TERPADU) */}
      <section id="about" className="py-24 bg-[#0E131F] relative">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">

            {/* Left Visual */}
            <div className="lg:col-span-6 relative space-y-4">
              <div className="relative rounded-3xl overflow-hidden shadow-2xl border border-white/10 aspect-[4/3] group">
                <Image
                  src="https://images.unsplash.com/photo-1527192491265-7e15c55b1ed2?q=80&w=1200&auto=format&fit=crop"
                  alt="Dago Creative Hub Workspace"
                  fill
                  unoptimized
                  className="object-cover transition-transform duration-700 group-hover:scale-105"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-slate-950/90 via-slate-950/30 to-transparent" />

                <div className="absolute bottom-6 left-6 right-6 text-white space-y-1.5">
                  <Badge className="bg-brand-orange text-white text-[10px] font-bold uppercase tracking-wider">
                    Integrated Ecosystem
                  </Badge>
                  <h3 className="font-black text-xl text-white">Dago Creative Hub Bali</h3>
                  <p className="text-xs text-slate-300 leading-relaxed">
                    Sinergi operasional F&B modern, ruang kerja bersama berkecepatan tinggi, dan program keanggotaan CRM terpadu.
                  </p>
                </div>
              </div>

              {/* Stats Highlights Bar */}
              <div className="grid grid-cols-3 gap-3">
                <div className="p-4 rounded-2xl bg-white/5 border border-white/10 text-center">
                  <span className="text-xl sm:text-2xl font-black text-brand-orange block">
                    <AnimatedCounter value={3} />
                  </span>
                  <span className="text-[10px] text-slate-400 font-bold uppercase">Outlet Bali</span>
                </div>
                <div className="p-4 rounded-2xl bg-white/5 border border-white/10 text-center">
                  <span className="text-xl sm:text-2xl font-black text-emerald-400 block">
                    100<span className="text-xs font-normal">Mbps</span>
                  </span>
                  <span className="text-[10px] text-slate-400 font-bold uppercase">Fiber Optic</span>
                </div>
                <div className="p-4 rounded-2xl bg-white/5 border border-white/10 text-center">
                  <span className="text-xl sm:text-2xl font-black text-blue-400 block">
                    100%
                  </span>
                  <span className="text-[10px] text-slate-400 font-bold uppercase">Cloud Sync</span>
                </div>
              </div>
            </div>

            {/* Right Content */}
            <div className="lg:col-span-6 space-y-6">
              <div className="space-y-2">
                <Badge variant="outline" className="text-brand-orange border-brand-orange/40 bg-brand-orange/10 font-black uppercase text-[10px] tracking-wider">
                  Tentang Dago Creative Hub
                </Badge>
                <h2 className="text-2xl sm:text-4xl font-black text-white tracking-tight leading-tight">
                  Ekosistem Terintegrasi untuk Produktivitas & Kuliner
                </h2>
                <p className="text-xs sm:text-sm text-slate-400 leading-relaxed pt-1">
                  Dago Creative Hub menghadirkan platform terpadu yang menghubungkan tamu, kasir POS terpadu, stasiun dapur KDS, dan loyalty points dalam satu ekosistem yang mulus.
                </p>
              </div>

              <div className="space-y-3 pt-2">
                {[
                  {
                    title: "Pemesanan Mandiri & Smart Kitchen Display",
                    desc: "Tamu memesan langsung via QR Meja, pesanan otomatis masuk ke stasiun dapur (KDS) mitra terkait.",
                  },
                  {
                    title: "Ruang Kerja & Meeting Room Fleksibel",
                    desc: "Pilihan Hot Desk harian hingga VIP Meeting Room dengan fasilitas audio visual lengkap.",
                  },
                  {
                    title: "Loyalty Points Otomatis",
                    desc: "Setiap transaksi F&B dan Co-Working menambah poin pelanggan secara otomatis.",
                  },
                ].map((item, idx) => (
                  <div
                    key={idx}
                    className="flex items-start space-x-3.5 p-4 rounded-2xl bg-white/5 border border-white/10 hover:border-brand-orange/40 hover:bg-white/10 transition-all duration-200"
                  >
                    <div className="w-7 h-7 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <Check className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="font-bold text-xs text-white">{item.title}</h4>
                      <p className="text-[11px] text-slate-400 leading-relaxed mt-0.5">{item.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* 6. SECTION: CABANG OUTLET (OVERVIEW DENGAN VIEW BRANCHES) */}
      <section id="outlets" className="py-24 bg-[#0B0F17] relative">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">

          <div className="text-center max-w-2xl mx-auto space-y-2">
            <Badge variant="outline" className="text-brand-orange border-brand-orange/40 bg-brand-orange/10 font-black uppercase text-[10px] tracking-wider">
              Jaringan Cabang Bali
            </Badge>
            <h2 className="text-2xl sm:text-4xl font-black text-white tracking-tight">
              Kunjungi Cabang Dago Terdekat
            </h2>
            <p className="text-xs sm:text-sm text-slate-400">
              Temukan suasana produktif dan sajian kuliner favorit di seluruh lokasi strategis Dago Creative Hub.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {outlets.map((outlet) => {
              const isComingSoon = outlet.isComingSoon;

              return (
                <div
                  key={outlet.id}
                  className={`p-6 rounded-3xl bg-slate-900/60 backdrop-blur-md border space-y-4 flex flex-col justify-between transition-all duration-300 group shadow-xl ${isComingSoon
                    ? "border-amber-500/20 hover:border-amber-500/40 opacity-90"
                    : "border-white/10 hover:border-brand-orange/50 hover:bg-slate-900"
                    }`}
                >
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2.5">
                        <div
                          className={`w-9 h-9 rounded-2xl flex items-center justify-center font-bold ${isComingSoon
                            ? "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                            : "bg-orange-500/20 text-brand-orange border border-orange-500/30"
                            }`}
                        >
                          <Store className="w-4 h-4" />
                        </div>
                        <div>
                          <h3 className="font-bold text-base text-white group-hover:text-brand-orange transition-colors">
                            {outlet.name}
                          </h3>
                          {outlet.id === "outlet-sgr" && (
                            <span className="text-[10px] text-emerald-400 font-bold block">
                              📍 Outlet Pusat Singaraja
                            </span>
                          )}
                        </div>
                      </div>
                      <Badge
                        className={`text-[10px] font-bold ${isComingSoon
                          ? "bg-amber-500/10 text-amber-300 border-amber-500/30"
                          : "bg-emerald-500/20 text-emerald-400 border-emerald-500/30"
                          }`}
                      >
                        {outlet.badgeLabel || (isComingSoon ? "⏳ Segera Hadir" : "● Buka")}
                      </Badge>
                    </div>

                    <div className="space-y-2 text-xs text-slate-400 pt-1">
                      <div className="flex items-start space-x-2">
                        <MapPin className="w-3.5 h-3.5 text-brand-orange mt-0.5 flex-shrink-0" />
                        <span>{outlet.address}</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Clock className="w-3.5 h-3.5 text-slate-500 flex-shrink-0" />
                        <span>
                          {isComingSoon
                            ? "Tahap Persiapan Cabang"
                            : "08:00 - 22:00 WITA (Setiap Hari)"}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="pt-3 border-t border-white/10 flex items-center justify-between text-xs">
                    <span className="font-mono text-[11px] text-slate-500 font-bold">{outlet.code}</span>
                    {isComingSoon ? (
                      <span className="text-xs font-semibold text-amber-400/80 italic">
                        Ekspansi Mendatang
                      </span>
                    ) : (
                      <Link
                        href={`/customer?outlet=${outlet.id}`}
                        className="font-bold text-brand-orange hover:text-orange-400 flex items-center group-hover:underline"
                      >
                        <span>Buka Cabang</span>
                        <ChevronRight className="w-3.5 h-3.5 ml-0.5" />
                      </Link>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

        </div>
      </section>

      {/* 7. SECTION: RINGKASAN LOYALTY REWARDS */}
      <section id="loyalty" className="py-16 bg-[#0E131F] relative overflow-hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="p-8 sm:p-10 rounded-3xl bg-gradient-to-r from-orange-950/60 via-slate-900 to-slate-900 border border-brand-orange/40 flex flex-col md:flex-row items-center justify-between gap-6 shadow-2xl">
            <div className="space-y-1.5 text-center md:text-left">
              <div className="flex items-center justify-center md:justify-start space-x-2">
                <Crown className="w-4 h-4 text-amber-400" />
                <span className="text-[10px] font-black uppercase tracking-wider text-amber-300">
                  DAGO Member Loyalty Program
                </span>
              </div>
              <h3 className="font-black text-xl sm:text-2xl text-white">Kumpulkan Poin Setiap Transaksi</h3>
              <p className="text-xs text-slate-300 max-w-xl">
                Nikmati diskon hingga 30%, free jam coworking, dan voucher reward spesial untuk setiap transaksi F&B dan Co-Working di DAGO.
              </p>
            </div>
            <Link href="/customer?tab=LOYALTY">
              <Button size="lg" className="h-12 px-7 font-black bg-brand-orange text-white hover:bg-orange-600 rounded-2xl text-xs shadow-lg shadow-orange-500/25 whitespace-nowrap">
                <span>Eksplor Program Member</span>
                <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* 8. SECTION: KONTAK & FOOTER */}
      <section id="contact" className="py-20 bg-[#0B0F17] border-t border-white/10 text-slate-300 relative">
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
                Ekosistem terpadu F&B kuliner artisan, Co-working space, dan Customer Loyalty modern di Bali.
              </p>
            </div>

            {/* Col 2: Kontak & Alamat */}
            <div className="space-y-2.5 text-xs">
              <h4 className="font-bold text-white uppercase tracking-wider text-xs">Hubungi Kami</h4>
              <div className="flex items-center space-x-2 text-slate-400">
                <MapPin className="w-4 h-4 text-brand-orange flex-shrink-0" />
                <span>	Jl. Teleng No.1, Banyuasri, Kec. Buleleng, Kabupaten Buleleng, Bali 8111</span>
              </div>
              <div className="flex items-center space-x-2 text-slate-400">
                <Phone className="w-4 h-4 text-brand-orange flex-shrink-0" />
                <span>+62 811-2233-4455</span>
              </div>
              <div className="flex items-center space-x-2 text-slate-400">
                <Mail className="w-4 h-4 text-brand-orange flex-shrink-0" />
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
                  className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-white/5 border border-white/10 hover:border-brand-orange hover:bg-white/10 text-slate-200 transition-colors"
                >
                  <Instagram className="w-3.5 h-3.5 text-pink-500" />
                  <span>@dagocreativehub</span>
                </a>
                <a
                  href="https://wa.me/6281122334455"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-white/5 border border-white/10 hover:border-brand-orange hover:bg-white/10 text-slate-200 transition-colors"
                >
                  <MessageCircle className="w-3.5 h-3.5 text-emerald-500" />
                  <span>WhatsApp CS</span>
                </a>
              </div>
            </div>

            {/* Col 4: Quick Direct Links */}
            <div className="space-y-2 text-xs">
              <h4 className="font-bold text-white uppercase tracking-wider text-xs">Navigasi Langsung</h4>
              <div className="flex flex-col space-y-1.5 text-slate-400">
                <Link href="/customer?tab=MENU" className="hover:text-brand-orange transition-colors">Layanan Kuliner (F&B)</Link>
                <Link href="/customer?tab=COWORKING" className="hover:text-brand-orange transition-colors">Layanan Co-Working Space</Link>
                <Link href="/customer?tab=LOYALTY" className="hover:text-brand-orange transition-colors">Program Member Loyalty</Link>
                <button onClick={() => setIsLoginModalOpen(true)} className="text-left hover:text-brand-orange transition-colors">
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
      </section>

      {/* 9. INTERACTIVE LOGIN MODAL POPUP */}
      {isLoginModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="fixed inset-0 bg-slate-950/80 backdrop-blur-md transition-opacity animate-in fade-in"
            onClick={() => setIsLoginModalOpen(false)}
          />

          <div className="relative w-full max-w-md bg-slate-900 border border-white/15 rounded-3xl p-6 sm:p-7 shadow-2xl z-10 text-white space-y-5 animate-in zoom-in-95 duration-200">

            {/* Modal Header */}
            <div className="flex items-center justify-between pb-3 border-b border-white/10">
              <div className="flex items-center space-x-2.5">
                <div className="w-8 h-8 rounded-xl bg-brand-orange/20 text-brand-orange flex items-center justify-center font-bold">
                  <LogIn className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-black text-base text-white">Masuk ke Sistem DagoEng</h3>
                  <p className="text-[11px] text-slate-400">Pilih akses cepat role untuk demo atau form login</p>
                </div>
              </div>
              <button
                onClick={() => setIsLoginModalOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Quick 1-Click Role Access Grid */}
            <div className="space-y-2">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                Akses Langsung 1-Klik Role:
              </span>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <button
                  onClick={() => handleQuickModalLogin("DAGO_OWNER")}
                  className="p-2.5 rounded-xl bg-white/5 hover:bg-brand-orange hover:text-white border border-white/10 text-left transition-all group"
                >
                  <span className="block font-bold text-white group-hover:text-white">🏢 Owner Dago Hub</span>
                  <span className="text-[10px] text-slate-400 group-hover:text-white/80">Executive Org</span>
                </button>

                <button
                  onClick={() => handleQuickModalLogin("TENANT_OWNER_KS")}
                  className="p-2.5 rounded-xl bg-white/5 hover:bg-brand-orange hover:text-white border border-white/10 text-left transition-all group"
                >
                  <span className="block font-bold text-white group-hover:text-white">☕ Owner Kopi Senja</span>
                  <span className="text-[10px] text-slate-400 group-hover:text-white/80">Tenant F&B</span>
                </button>

                <button
                  onClick={() => handleQuickModalLogin("CASHIER_SGR")}
                  className="p-2.5 rounded-xl bg-white/5 hover:bg-brand-orange hover:text-white border border-white/10 text-left transition-all group"
                >
                  <span className="block font-bold text-white group-hover:text-white">🛒 Kasir POS</span>
                  <span className="text-[10px] text-slate-400 group-hover:text-white/80">Singaraja POS</span>
                </button>

                <button
                  onClick={() => handleQuickModalLogin("KITCHEN_SGR")}
                  className="p-2.5 rounded-xl bg-white/5 hover:bg-brand-orange hover:text-white border border-white/10 text-left transition-all group"
                >
                  <span className="block font-bold text-white group-hover:text-white">🍳 Chef Dapur (KDS)</span>
                  <span className="text-[10px] text-slate-400 group-hover:text-white/80">Antrean Dapur</span>
                </button>

                <button
                  onClick={() => handleQuickModalLogin("WAITER_SGR")}
                  className="p-2.5 rounded-xl bg-white/5 hover:bg-brand-orange hover:text-white border border-white/10 text-left transition-all group"
                >
                  <span className="block font-bold text-white group-hover:text-white">🤵 Pramusaji / Waiter</span>
                  <span className="text-[10px] text-slate-400 group-hover:text-white/80">Denah Meja</span>
                </button>

                <button
                  onClick={() => handleQuickModalLogin("CUSTOMER_DEMO")}
                  className="p-2.5 rounded-xl bg-white/5 hover:bg-brand-orange hover:text-white border border-white/10 text-left transition-all group"
                >
                  <span className="block font-bold text-white group-hover:text-white">📱 Pelanggan QR</span>
                  <span className="text-[10px] text-slate-400 group-hover:text-white/80">Customer Portal</span>
                </button>
              </div>
            </div>

            {/* Link to Full Login Form */}
            <div className="pt-2 border-t border-white/10 flex items-center justify-between text-xs">
              <Link
                href="/login"
                onClick={() => setIsLoginModalOpen(false)}
                className="text-brand-orange font-bold hover:underline flex items-center space-x-1"
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

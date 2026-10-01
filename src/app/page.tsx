"use client";

import React, { useState, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth, PersonaKey, DEMO_PERSONAS } from "@/contexts/AuthContext";
import { useOutlet } from "@/contexts/OutletContext";
import { useProducts } from "@/contexts/ProductContext";
import { formatCurrencyIDR } from "@/lib/utils";
import { AnimatedCounter } from "@/components/ui/animated-counter";
import {
  UtensilsCrossed,
  Laptop,
  Award,
  Store,
  ArrowRight,
  Sparkles,
  ShieldCheck,
  CheckCircle2,
  Clock,
  MapPin,
  Wifi,
  ChevronRight,
  LogIn,
  ChefHat,
  Receipt,
  Phone,
  Search,
  Users,
  Calendar,
  Layers,
  ChevronLeft,
  Coffee,
  Check,
  Building2,
  Crown,
  Star,
  Zap,
  Menu,
  X,
  Mail,
  Instagram,
  MessageCircle,
  ExternalLink,
  ShieldAlert,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";

// Hero Slides Data
const HERO_SLIDES = [
  {
    id: 1,
    title: "Sajian Kuliner Artisan & Kopi Spesialti",
    subtitle: "Nikmati aneka seduhan kopi lokal pilihan dan hidangan kuliner premium dengan pemesanan mandiri cepat via QR Meja.",
    badge: "F&B POS & Kitchen Display",
    bgImage: "https://images.unsplash.com/photo-1501339847302-ac426a4a7cbb?q=80&w=1920&auto=format&fit=crop",
    ctaText: "Pesan Menu Kuliner",
    ctaLink: "/customer?tab=MENU",
  },
  {
    id: 2,
    title: "Ruang Kerja Kolaboratif & Meeting Room",
    subtitle: "Hot desk fleksibel, dedicated nomad desk, dan meeting suite kedap suara dengan koneksi fiber optic dedicated 100 Mbps.",
    badge: "Co-working & Creative Hub",
    bgImage: "https://images.unsplash.com/photo-1497366216548-37526070297c?q=80&w=1920&auto=format&fit=crop",
    ctaText: "Reservasi Ruang Kerja",
    ctaLink: "/customer?tab=COWORKING",
  },
  {
    id: 3,
    title: "Kumpulkan Poin Loyalty & Nikmati Reward",
    subtitle: "Dapatkan poin otomatis setiap transaksi untuk ditukar voucher diskon makan, gratis refill, dan benefit eksklusif member.",
    badge: "Member Loyalty Rewards",
    bgImage: "https://images.unsplash.com/photo-1527192491265-7e15c55b1ed2?q=80&w=1920&auto=format&fit=crop",
    ctaText: "Cek Poin & Member",
    ctaLink: "/customer?tab=LOYALTY",
  },
];

// Featured Culinary Images
const FEATURED_CULINARY = [
  {
    id: "m-1",
    name: "Kopi Senja Aren Blend",
    category: "Signature Coffee",
    price: 24000,
    rating: "4.9",
    reviews: "1.2k",
    desc: "Single origin Arabica Kintamani dipadu susu murni & gula aren organik Bali.",
    image: "https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?q=80&w=800&auto=format&fit=crop",
    tag: "Best Seller",
  },
  {
    id: "m-2",
    name: "Signature Wagyu Beef Bowl",
    category: "Main Course",
    price: 65000,
    rating: "5.0",
    reviews: "980",
    desc: "Daging Wagyu slice empuk dengan bumbu tare autentik dan telur onsen lembut.",
    image: "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?q=80&w=800&auto=format&fit=crop",
    tag: "Chef Special",
  },
  {
    id: "m-3",
    name: "Artisan Peach White Tea",
    category: "Artisan Tea",
    price: 28000,
    rating: "4.8",
    reviews: "640",
    desc: "Seduhan teh putih organik dengan sari buah peach segar yang menenangkan.",
    image: "https://images.unsplash.com/photo-1576092768241-dec231879fc3?q=80&w=800&auto=format&fit=crop",
    tag: "Refreshing",
  },
  {
    id: "m-4",
    name: "Flaky French Butter Croissant",
    category: "Pastry & Bakery",
    price: 20000,
    rating: "4.9",
    reviews: "820",
    desc: "Croissant berlapis renyah dengan aroma butter Prancis autentik yang lezat.",
    image: "https://images.unsplash.com/photo-1555507036-ab1f4038808a?q=80&w=800&auto=format&fit=crop",
    tag: "Freshly Baked",
  },
];

// Loyalty Tiers Preview
const LOYALTY_TIERS = [
  {
    tier: "Bronze",
    minPoints: "0 - 499 Poin",
    badgeColor: "bg-amber-800/80 text-amber-100 border-amber-600/40",
    perks: ["Poin 1x per transaksi", "Voucher selamat datang", "Akses menu reguler"],
  },
  {
    tier: "Silver",
    minPoints: "500 - 1.499 Poin",
    badgeColor: "bg-slate-300 text-slate-900 border-slate-200",
    perks: ["Diskon 10% F&B", "Free 1 jam Co-working", "Prioritas meja reservasi"],
  },
  {
    tier: "Gold",
    minPoints: "1.500 - 2.999 Poin",
    badgeColor: "bg-amber-400 text-amber-950 border-amber-300",
    isPopular: true,
    perks: ["Diskon 20% F&B", "Free 2 jam VIP Meeting", "Gratis birthday drink", "Point multiplier 1.5x"],
  },
  {
    tier: "Platinum",
    minPoints: "3.000+ Poin",
    badgeColor: "bg-gradient-to-r from-purple-400 to-indigo-300 text-slate-950 font-black",
    perks: ["Diskon 30% All Services", "Dedicated Nomad Desk", "Undangan VIP Event", "Point multiplier 2x"],
  },
];

export default function PublicLandingPage() {
  const router = useRouter();
  const { user, login } = useAuth();
  const { outlets } = useOutlet();

  // Scroll State for Navbar Glassmorphism
  const [isScrolled, setIsScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);

  // Hero Carousel State (Snappy 2.5-second transition)
  const [currentSlide, setCurrentSlide] = useState(0);

  // Quick Service Finder State
  const [selectedOutlet, setSelectedOutlet] = useState("outlet-sgr");
  const [selectedService, setSelectedService] = useState("MENU");

  // Scroll detection
  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 25);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // Auto-advance hero carousel
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % HERO_SLIDES.length);
    }, 2500);
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
      el.scrollIntoView({ behavior: "smooth" });
    }
  };

  return (
    <div className="min-h-screen bg-[#0B0F17] text-slate-100 font-sans flex flex-col justify-between selection:bg-brand-orange selection:text-white scroll-smooth overflow-x-hidden">
      
      {/* 1. FLOATING TRANSPARENT GLASSMORPHISM NAVBAR */}
      <header
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
          isScrolled
            ? "bg-slate-950/85 backdrop-blur-xl border-b border-white/10 shadow-2xl py-3"
            : "bg-gradient-to-b from-slate-950/80 via-slate-950/40 to-transparent py-4 sm:py-5"
        }`}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between">
          
          {/* Brand Logo & Name */}
          <Link href="/" className="flex items-center space-x-3 group">
            <div className="w-9 h-11 relative flex-shrink-0 transition-transform duration-300 group-hover:scale-105">
              <Image
                src="/logo-dago.png"
                alt="DagoEng Logo"
                width={36}
                height={44}
                priority
                className="object-contain drop-shadow-md"
              />
            </div>
            <div>
              <span className="font-black text-lg tracking-tight text-white block leading-none drop-shadow-sm">
                DagoEng <span className="text-brand-orange">Creative Hub</span>
              </span>
              <span className="text-[10px] font-bold text-slate-400 tracking-wider uppercase">
                F&B Management & Coworking
              </span>
            </div>
          </Link>

          {/* Desktop Nav Links with Smooth Animation */}
          <nav className="hidden lg:flex items-center space-x-1 p-1.5 rounded-full bg-white/5 backdrop-blur-md border border-white/10 text-xs font-semibold text-slate-300">
            {[
              { id: "about", label: "Tentang Kami" },
              { id: "menu", label: "Menu Kuliner" },
              { id: "coworking", label: "Co-working Space" },
              { id: "outlets", label: "Cabang Outlet" },
              { id: "loyalty", label: "Loyalty Rewards" },
              { id: "contact", label: "Kontak" },
            ].map((item) => (
              <button
                key={item.id}
                onClick={() => scrollToSection(item.id)}
                className="px-4 py-2 rounded-full hover:text-white hover:bg-white/10 transition-all duration-200"
              >
                {item.label}
              </button>
            ))}
          </nav>

          {/* Action Buttons */}
          <div className="hidden sm:flex items-center space-x-3">
            <Link href="/customer">
              <Button
                size="sm"
                className="text-xs h-10 px-5 font-black bg-brand-orange text-white hover:bg-orange-600 shadow-lg shadow-orange-500/25 rounded-xl transition-all duration-200 hover:scale-105 active:scale-95 border border-orange-400/40"
              >
                <UtensilsCrossed className="w-3.5 h-3.5 mr-1.5" />
                <span>Customer Portal</span>
              </Button>
            </Link>

            {/* Interactive Login Modal Button */}
            <Button
              onClick={() => setIsLoginModalOpen(true)}
              variant="outline"
              size="sm"
              className="text-xs h-10 px-4 font-bold bg-white/5 backdrop-blur-md border-white/20 text-slate-200 hover:bg-white/15 hover:text-white hover:border-white/40 rounded-xl transition-all"
            >
              <LogIn className="w-3.5 h-3.5 mr-1.5 text-brand-orange" />
              <span>{user ? `Akun: ${user.name.split(" ")[0]}` : "Masuk Sistem"}</span>
            </Button>
          </div>

          {/* Mobile Menu Toggle Button */}
          <div className="flex sm:hidden items-center space-x-2">
            <Link href="/customer">
              <Button size="sm" className="text-[11px] h-8 px-3 font-bold bg-brand-orange text-white rounded-lg">
                Portal
              </Button>
            </Link>
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 rounded-xl bg-white/10 text-white hover:bg-white/20 transition-colors"
              aria-label="Toggle Menu"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>

        </div>

        {/* Mobile Dropdown Menu */}
        {mobileMenuOpen && (
          <div className="sm:hidden px-4 pt-3 pb-6 bg-slate-950/95 backdrop-blur-2xl border-b border-white/10 space-y-3 animate-in slide-in-from-top-2 duration-200">
            <div className="flex flex-col space-y-2 text-sm font-semibold text-slate-300">
              {["about", "menu", "coworking", "outlets", "loyalty", "contact"].map((sec) => (
                <button
                  key={sec}
                  onClick={() => {
                    setMobileMenuOpen(false);
                    scrollToSection(sec);
                  }}
                  className="p-2.5 rounded-xl hover:bg-white/5 hover:text-white text-left capitalize"
                >
                  {sec === "about" ? "Tentang Kami" : sec === "menu" ? "Menu Kuliner" : sec === "coworking" ? "Co-working Space" : sec === "outlets" ? "Cabang Outlet" : sec === "loyalty" ? "Loyalty Rewards" : "Kontak & Medsos"}
                </button>
              ))}
            </div>

            <div className="pt-3 border-t border-white/10 flex flex-col gap-2">
              <Link href="/customer" onClick={() => setMobileMenuOpen(false)}>
                <Button className="w-full bg-brand-orange text-white font-bold text-xs h-10 rounded-xl">
                  Buka Customer Portal
                </Button>
              </Link>
              <Button
                onClick={() => {
                  setMobileMenuOpen(false);
                  setIsLoginModalOpen(true);
                }}
                variant="outline"
                className="w-full bg-white/5 text-slate-200 border-white/20 font-bold text-xs h-10 rounded-xl"
              >
                Masuk / Login Multi-Role
              </Button>
            </div>
          </div>
        )}
      </header>

      {/* 2. HERO SLIDESHOW */}
      <section className="relative min-h-[640px] sm:min-h-[700px] lg:min-h-[760px] flex items-center justify-center overflow-hidden bg-slate-950 text-white pt-24 sm:pt-28">
        {HERO_SLIDES.map((slide, idx) => (
          <div
            key={slide.id}
            className={`absolute inset-0 transition-all duration-700 ease-out ${
              idx === currentSlide
                ? "opacity-100 scale-100"
                : "opacity-0 scale-105 pointer-events-none"
            }`}
          >
            <div
              className="absolute inset-0 bg-cover bg-center transition-transform duration-[2500ms] ease-linear"
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
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 relative z-20 w-full">
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

            {/* Hero CTAs */}
            <div className="pt-3 flex flex-col sm:flex-row items-center gap-4">
              <Link href={HERO_SLIDES[currentSlide].ctaLink} className="w-full sm:w-auto">
                <Button
                  size="lg"
                  className="w-full sm:w-auto h-13 px-8 font-black bg-brand-orange text-white hover:bg-orange-600 shadow-xl shadow-orange-500/30 rounded-2xl text-xs sm:text-sm transition-all hover:scale-105 active:scale-95 border border-orange-400/40 group"
                >
                  <span>{HERO_SLIDES[currentSlide].ctaText}</span>
                  <ArrowRight className="w-4 h-4 ml-2 transition-transform group-hover:translate-x-1" />
                </Button>
              </Link>

              <Button
                onClick={() => setIsLoginModalOpen(true)}
                size="lg"
                variant="outline"
                className="w-full sm:w-auto h-13 px-7 font-bold bg-white/10 backdrop-blur-md text-white border-white/30 hover:bg-white/20 hover:border-white/60 rounded-2xl text-xs sm:text-sm transition-all"
              >
                <LogIn className="w-4 h-4 mr-2 text-brand-orange" />
                <span>Masuk Staf / Owner</span>
              </Button>
            </div>

            {/* Slide Navigation Progress */}
            <div className="pt-6 flex items-center space-x-3">
              {HERO_SLIDES.map((_, idx) => (
                <button
                  key={idx}
                  onClick={() => setCurrentSlide(idx)}
                  className={`h-2 rounded-full transition-all duration-300 ${
                    idx === currentSlide
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

        {/* Carousel Arrow Controls */}
        <button
          onClick={() => setCurrentSlide((prev) => (prev === 0 ? HERO_SLIDES.length - 1 : prev - 1))}
          className="absolute left-6 top-1/2 -translate-y-1/2 z-20 w-11 h-11 rounded-2xl bg-slate-900/60 backdrop-blur-md border border-white/15 text-white flex items-center justify-center hover:bg-brand-orange hover:border-brand-orange transition-all duration-200 hidden lg:flex shadow-lg"
          aria-label="Previous Slide"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
        <button
          onClick={() => setCurrentSlide((prev) => (prev + 1) % HERO_SLIDES.length)}
          className="absolute right-6 top-1/2 -translate-y-1/2 z-20 w-11 h-11 rounded-2xl bg-slate-900/60 backdrop-blur-md border border-white/15 text-white flex items-center justify-center hover:bg-brand-orange hover:border-brand-orange transition-all duration-200 hidden lg:flex shadow-lg"
          aria-label="Next Slide"
        >
          <ChevronRight className="w-5 h-5" />
        </button>
      </section>

      {/* 3. QUICK SEARCH & SERVICE FINDER */}
      <section className="relative z-30 -mt-10 sm:-mt-12 max-w-6xl mx-auto px-4 sm:px-6 w-full">
        <div className="bg-slate-900/95 backdrop-blur-xl rounded-3xl p-4 sm:p-5 shadow-2xl border border-white/15 flex flex-col md:flex-row items-center justify-between gap-4 text-white">
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full md:w-auto flex-1">
            {/* Select Location */}
            <div className="flex items-center space-x-3 p-3 rounded-2xl bg-white/5 border border-white/10 hover:border-brand-orange/50 transition-colors">
              <MapPin className="w-5 h-5 text-brand-orange flex-shrink-0" />
              <div className="space-y-0.5 flex-1">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                  Pilih Lokasi Cabang
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
                      {o.name} {o.isComingSoon ? "— ⏳ (Segera Hadir / Ekspansi)" : `(${o.address})`}
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
                  Layanan Dago Hub
                </span>
                <select
                  value={selectedService}
                  onChange={(e) => setSelectedService(e.target.value)}
                  className="bg-transparent text-xs font-bold text-white outline-none w-full cursor-pointer"
                >
                  <option value="MENU" className="bg-slate-900 text-white">🍽️ Menu Kuliner & Kopi</option>
                  <option value="COWORKING" className="bg-slate-900 text-white">💻 Co-working & Meeting Room</option>
                  <option value="LOYALTY" className="bg-slate-900 text-white">🎁 Cek Poin & Loyalty Reward</option>
                  <option value="ORDERS" className="bg-slate-900 text-white">📋 Status Pesanan Saya</option>
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

      {/* 4. SECTION: TENTANG KAMI */}
      <section id="about" className="py-24 bg-[#0E131F] border-b border-white/5 relative">
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
                  DagoEng F&B Management menghadirkan standar operasional modern. Kami menghubungkan pengalaman pemesanan mandiri tamu, sistem POS kasir cerdas, Kitchen Display System dapur, dan loyalty rewards ke dalam satu platform yang mulus.
                </p>
              </div>

              <div className="space-y-3 pt-2">
                {[
                  {
                    title: "Pemesanan Mandiri & Smart Kitchen Display",
                    desc: "Tamu memesan langsung via QR Meja, pesanan langsung diteruskan ke stasiun dapur (KDS), dan SLA waktu tunggu terpantau real-time.",
                  },
                  {
                    title: "Ruang Kerja & Meeting Room Fleksibel",
                    desc: "Pilihan Hot Desk, Dedicated Nomad Desk, hingga VIP Meeting Room dengan proyektor 4K dan free flow kopi/teh.",
                  },
                  {
                    title: "Otomatisasi Loyalty Points & Tier Upgrade",
                    desc: "Setiap transaksi selesai otomatis menambah poin pelanggan dan menaikkan status tier dari Bronze hingga Platinum.",
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

              <div className="pt-2">
                <Link href="/customer">
                  <Button className="h-12 px-7 font-black bg-brand-orange text-white hover:bg-orange-600 rounded-2xl text-xs shadow-lg shadow-orange-500/20">
                    <span>Mulai Eksplorasi Layanan</span>
                    <ArrowRight className="w-3.5 h-3.5 ml-2" />
                  </Button>
                </Link>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* 5. SECTION: MENU KULINER ARTISAN */}
      <section id="menu" className="py-24 bg-[#0B0F17] border-b border-white/5 relative">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
          
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
            <div className="space-y-2 max-w-xl">
              <Badge variant="outline" className="text-brand-orange border-brand-orange/40 bg-brand-orange/10 font-black uppercase text-[10px] tracking-wider">
                Signature Culinary & Coffee
              </Badge>
              <h2 className="text-2xl sm:text-4xl font-black text-white tracking-tight">
                Cita Rasa Autentik & Kopi Spesialti
              </h2>
              <p className="text-xs sm:text-sm text-slate-400">
                Diolah dari biji kopi lokal organik dan bahan baku segar berstandar tinggi oleh barista & chef profesional kami.
              </p>
            </div>

            <Link href="/customer?tab=MENU">
              <Button variant="outline" className="h-11 px-5 text-xs font-bold bg-white/5 border-white/20 text-slate-200 hover:bg-white/10 hover:text-white rounded-xl">
                <span>Lihat Semua Menu di Portal</span>
                <ChevronRight className="w-4 h-4 ml-1 text-brand-orange" />
              </Button>
            </Link>
          </div>

          {/* Featured Menu Cards Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {FEATURED_CULINARY.map((item) => (
              <Card
                key={item.id}
                className="border-white/10 bg-slate-900/60 backdrop-blur-md shadow-xl hover:shadow-2xl hover:border-brand-orange/50 hover:-translate-y-1.5 transition-all duration-300 rounded-3xl overflow-hidden flex flex-col justify-between group"
              >
                <div>
                  <div className="relative h-44 w-full overflow-hidden bg-slate-800">
                    <Image
                      src={item.image}
                      alt={item.name}
                      fill
                      unoptimized
                      className="object-cover transition-transform duration-500 group-hover:scale-110"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-transparent to-transparent" />
                    
                    <span className="absolute top-3 left-3 bg-brand-orange text-white text-[10px] font-black px-2.5 py-0.5 rounded-full uppercase tracking-wider shadow-md">
                      {item.tag}
                    </span>

                    <div className="absolute bottom-2.5 right-3 flex items-center space-x-1 bg-slate-950/80 backdrop-blur-md px-2 py-0.5 rounded-md border border-white/10 text-[10px] text-amber-300 font-bold">
                      <Star className="w-3 h-3 fill-amber-300" />
                      <span>{item.rating}</span>
                      <span className="text-slate-400">({item.reviews})</span>
                    </div>
                  </div>

                  <div className="p-5 space-y-2">
                    <span className="text-[10px] font-bold uppercase text-brand-orange tracking-wider">
                      {item.category}
                    </span>
                    <h3 className="font-black text-base text-white group-hover:text-brand-orange transition-colors">
                      {item.name}
                    </h3>
                    <p className="text-[11px] text-slate-400 line-clamp-2 leading-relaxed">
                      {item.desc}
                    </p>
                  </div>
                </div>

                <div className="p-5 pt-3 border-t border-white/10 flex items-center justify-between">
                  <div>
                    <span className="text-[10px] text-slate-500 font-bold block">Harga Satuan</span>
                    <span className="font-black text-base text-white">
                      {formatCurrencyIDR(item.price)}
                    </span>
                  </div>
                  <Link href="/customer?tab=MENU">
                    <Button size="sm" className="h-9 px-4 text-xs font-black bg-brand-orange hover:bg-orange-600 text-white rounded-xl transition-all shadow-md shadow-orange-500/20">
                      Pesan
                    </Button>
                  </Link>
                </div>
              </Card>
            ))}
          </div>

        </div>
      </section>

      {/* 6. SECTION: CO-WORKING SPACE (DYNAMIC HOVER ORANGE GRADIENT) */}
      <section id="coworking" className="py-24 bg-[#0E131F] border-b border-white/5 relative">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
          
          <div className="text-center max-w-2xl mx-auto space-y-2">
            <Badge variant="outline" className="text-brand-orange border-brand-orange/40 bg-brand-orange/10 font-black uppercase text-[10px] tracking-wider">
              Workspace & Meeting Suites
            </Badge>
            <h2 className="text-2xl sm:text-4xl font-black text-white tracking-tight">
              Pilihan Ruang Kerja & Ruang Rapat
            </h2>
            <p className="text-xs sm:text-sm text-slate-400">
              Kenyamanan bekerja prima untuk nomad worker, remote team, hingga meeting privat representatif.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            
            {/* Hot Desk Flex - Hover transforms to glowing orange gradient */}
            <div className="p-6 rounded-3xl bg-slate-900/80 border border-white/10 space-y-5 flex flex-col justify-between transition-all duration-300 hover:border-brand-orange hover:bg-gradient-to-b hover:from-orange-950/40 hover:via-slate-900 hover:to-slate-900 hover:shadow-2xl hover:shadow-orange-500/15 group">
              <div className="space-y-3">
                <Badge className="bg-slate-800 group-hover:bg-brand-orange text-slate-200 group-hover:text-white transition-colors text-[10px] font-bold">
                  HOT DESK FLEX
                </Badge>
                <h3 className="font-black text-xl text-white group-hover:text-brand-orange transition-colors">
                  Hot Desk Harian
                </h3>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Akses meja kerja fleksibel di open space area dengan kursi ergonomis dan power outlet di setiap titik.
                </p>
                <div className="pt-3 border-t border-white/10 space-y-2 text-xs text-slate-300">
                  <div className="flex items-center space-x-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 group-hover:text-brand-orange transition-colors" />
                    <span>WiFi Dedicated 100 Mbps</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 group-hover:text-brand-orange transition-colors" />
                    <span>Free Flow Air Mineral & Artisan Tea</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 group-hover:text-brand-orange transition-colors" />
                    <span>Akses Charging Station Cepat</span>
                  </div>
                </div>
              </div>

              <div className="pt-4 border-t border-white/10 flex items-center justify-between">
                <div>
                  <span className="text-[10px] text-slate-400 block font-bold">Tarif Sewa</span>
                  <span className="font-black text-base text-white">Rp 15.000 <span className="text-[10px] text-slate-400 font-normal">/jam</span></span>
                </div>
                <Link href="/customer?tab=COWORKING">
                  <Button size="sm" className="bg-white/10 group-hover:bg-brand-orange group-hover:text-white text-white font-bold text-xs h-9 px-4 rounded-xl border border-white/20 transition-all">
                    Booking
                  </Button>
                </Link>
              </div>
            </div>

            {/* Dedicated Nomad Desk - Hover transforms to glowing orange gradient */}
            <div className="p-6 rounded-3xl bg-slate-900/80 border border-white/10 space-y-5 flex flex-col justify-between transition-all duration-300 hover:border-brand-orange hover:bg-gradient-to-b hover:from-orange-950/40 hover:via-slate-900 hover:to-slate-900 hover:shadow-2xl hover:shadow-orange-500/15 group">
              <div className="space-y-3">
                <Badge className="bg-slate-800 group-hover:bg-brand-orange text-slate-200 group-hover:text-white transition-colors text-[10px] font-bold">
                  DEDICATED DESK
                </Badge>
                <h3 className="font-black text-xl text-white group-hover:text-brand-orange transition-colors">
                  Dedicated Nomad Desk
                </h3>
                <p className="text-xs text-slate-300 leading-relaxed">
                  Meja pribadi tetap di quiet zone dengan kursi Herman Miller, dual monitor 27 inci, dan loker privat.
                </p>
                <div className="pt-3 border-t border-white/10 space-y-2 text-xs text-slate-200">
                  <div className="flex items-center space-x-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 group-hover:text-brand-orange transition-colors" />
                    <span>Free 2 Jam Meeting Room / Bulan</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 group-hover:text-brand-orange transition-colors" />
                    <span>Diskon 20% Menu Kuliner & Kopi</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 group-hover:text-brand-orange transition-colors" />
                    <span>Loker Pribadi & Alamat Surat Bisnis</span>
                  </div>
                </div>
              </div>

              <div className="pt-4 border-t border-white/10 flex items-center justify-between">
                <div>
                  <span className="text-[10px] text-slate-400 block font-bold">Paket Bulanan</span>
                  <span className="font-black text-lg text-white group-hover:text-brand-orange transition-colors">
                    Rp 1.850.000 <span className="text-[10px] text-slate-400 font-normal">/bln</span>
                  </span>
                </div>
                <Link href="/customer?tab=COWORKING">
                  <Button size="sm" className="bg-white/10 group-hover:bg-brand-orange group-hover:text-white text-white font-bold text-xs h-9 px-4 rounded-xl border border-white/20 transition-all">
                    Booking
                  </Button>
                </Link>
              </div>
            </div>

            {/* VIP Meeting Suite - Hover transforms to glowing orange gradient */}
            <div className="p-6 rounded-3xl bg-slate-900/80 border border-white/10 space-y-5 flex flex-col justify-between transition-all duration-300 hover:border-brand-orange hover:bg-gradient-to-b hover:from-orange-950/40 hover:via-slate-900 hover:to-slate-900 hover:shadow-2xl hover:shadow-orange-500/15 group">
              <div className="space-y-3">
                <Badge className="bg-slate-800 group-hover:bg-brand-orange text-slate-200 group-hover:text-white transition-colors text-[10px] font-bold">
                  VIP MEETING ROOM
                </Badge>
                <h3 className="font-black text-xl text-white group-hover:text-brand-orange transition-colors">
                  VIP Meeting Suite
                </h3>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Ruang pertemuan kedap suara kapasitas 8-12 orang dengan Smart TV 65 inci 4K, webcam conference, dan whiteboard.
                </p>
                <div className="pt-3 border-t border-white/10 space-y-2 text-xs text-slate-300">
                  <div className="flex items-center space-x-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 group-hover:text-brand-orange transition-colors" />
                    <span>Kapasitas 8-12 Orang Nyaman</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 group-hover:text-brand-orange transition-colors" />
                    <span>Layanan Pramusaji Kopi & Snack</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 group-hover:text-brand-orange transition-colors" />
                    <span>Hybrid Video Conference Ready</span>
                  </div>
                </div>
              </div>

              <div className="pt-4 border-t border-white/10 flex items-center justify-between">
                <div>
                  <span className="text-[10px] text-slate-400 block font-bold">Tarif Sewa</span>
                  <span className="font-black text-base text-white">Rp 120.000 <span className="text-[10px] text-slate-400 font-normal">/jam</span></span>
                </div>
                <Link href="/customer?tab=COWORKING">
                  <Button size="sm" className="bg-white/10 group-hover:bg-brand-orange group-hover:text-white text-white font-bold text-xs h-9 px-4 rounded-xl border border-white/20 transition-all">
                    Reservasi
                  </Button>
                </Link>
              </div>
            </div>

          </div>

        </div>
      </section>

      {/* 7. SECTION: CABANG OUTLET */}
      <section id="outlets" className="py-24 bg-[#0B0F17] border-b border-white/5 relative">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
          
          <div className="text-center max-w-2xl mx-auto space-y-2">
            <Badge variant="outline" className="text-brand-orange border-brand-orange/40 bg-brand-orange/10 font-black uppercase text-[10px] tracking-wider">
              Jaringan Cabang Bali
            </Badge>
            <h2 className="text-2xl sm:text-4xl font-black text-white tracking-tight">
              Kunjungi Cabang DagoEng Terdekat
            </h2>
            <p className="text-xs sm:text-sm text-slate-400">
              Temukan suasana produktif dan sajian kuliner favorit di seluruh lokasi strategis kami.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {outlets.map((outlet) => {
              const isComingSoon = outlet.isComingSoon;

              return (
                <div
                  key={outlet.id}
                  className={`p-6 rounded-3xl bg-slate-900/60 backdrop-blur-md border space-y-4 flex flex-col justify-between transition-all duration-300 group shadow-xl ${
                    isComingSoon
                      ? "border-amber-500/20 hover:border-amber-500/40 opacity-90"
                      : "border-white/10 hover:border-brand-orange/50 hover:bg-slate-900"
                  }`}
                >
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2.5">
                        <div
                          className={`w-9 h-9 rounded-2xl flex items-center justify-center font-bold ${
                            isComingSoon
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
                              📍 Kantor & Outlet Pusat
                            </span>
                          )}
                        </div>
                      </div>
                      <Badge
                        className={`text-[10px] font-bold ${
                          isComingSoon
                            ? "bg-amber-500/10 text-amber-300 border-amber-500/30"
                            : "bg-emerald-500/20 text-emerald-400 border-emerald-500/30"
                        }`}
                      >
                        {outlet.badgeLabel || (isComingSoon ? "⏳ Segera Hadir" : "● Buka Sekarang")}
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
                            ? "Tahap Persiapan & Renovasi Cabang"
                            : "08:00 - 22:00 WITA (Setiap Hari)"}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="pt-3 border-t border-white/10 flex items-center justify-between text-xs">
                    <span className="font-mono text-[11px] text-slate-500 font-bold">{outlet.code}</span>
                    {isComingSoon ? (
                      <span className="text-xs font-semibold text-amber-400/80 italic flex items-center">
                        <span>Ekspansi Mendatang</span>
                      </span>
                    ) : (
                      <Link
                        href={`/customer?outlet=${outlet.id}`}
                        className="font-bold text-brand-orange hover:text-orange-400 flex items-center group-hover:underline"
                      >
                        <span>Buka Portal Cabang</span>
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

      {/* 8. SECTION: LOYALTY REWARDS & TIER SHOWCASE (HOVER DYNAMIC ORANGE) */}
      <section id="loyalty" className="py-24 bg-[#0E131F] border-b border-white/5 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-brand-orange/10 rounded-full blur-3xl pointer-events-none" />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12 relative z-10">
          
          <div className="text-center max-w-2xl mx-auto space-y-2">
            <Badge variant="outline" className="text-brand-orange border-brand-orange/40 bg-brand-orange/10 font-black uppercase text-[10px] tracking-wider">
              Member Loyalty Program
            </Badge>
            <h2 className="text-2xl sm:text-4xl font-black text-white tracking-tight">
              Tingkatkan Tier & Nikmati Reward Eksklusif
            </h2>
            <p className="text-xs sm:text-sm text-slate-400">
              Setiap transaksi menghasilkan poin otomatis untuk menaikkan status member dan menikmati diskon hingga 30%.
            </p>
          </div>

          {/* 4 Tiers Grid - Hover illuminates orange */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {LOYALTY_TIERS.map((tierItem) => (
              <div
                key={tierItem.tier}
                className="p-6 rounded-3xl bg-slate-900/80 border border-white/10 space-y-4 flex flex-col justify-between transition-all duration-300 hover:border-brand-orange hover:bg-gradient-to-b hover:from-orange-950/40 hover:via-slate-900 hover:to-slate-900 hover:shadow-2xl hover:shadow-orange-500/15 hover:-translate-y-1 group relative"
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className={`px-2.5 py-1 rounded-lg text-xs font-black uppercase border ${tierItem.badgeColor}`}>
                      {tierItem.tier}
                    </span>
                    <Crown className="w-4 h-4 text-amber-400 group-hover:scale-110 transition-transform" />
                  </div>

                  <span className="font-mono text-xs text-slate-400 block font-bold">
                    {tierItem.minPoints}
                  </span>

                  <div className="pt-2 border-t border-white/10 space-y-1.5 text-xs text-slate-300">
                    {tierItem.perks.map((p, idx) => (
                      <div key={idx} className="flex items-center space-x-2">
                        <Check className="w-3.5 h-3.5 text-brand-orange flex-shrink-0" />
                        <span className="text-[11px]">{p}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="pt-3 border-t border-white/10">
                  <Link href="/customer?tab=LOYALTY">
                    <Button
                      size="sm"
                      className="w-full text-xs font-bold h-9 rounded-xl bg-white/10 group-hover:bg-brand-orange group-hover:text-white text-white border border-white/20 transition-all"
                    >
                      Gabung Member
                    </Button>
                  </Link>
                </div>
              </div>
            ))}
          </div>

          {/* Quick CTA Banner */}
          <div className="p-8 sm:p-10 rounded-3xl bg-gradient-to-r from-orange-950/60 via-slate-900 to-slate-900 border border-brand-orange/40 flex flex-col md:flex-row items-center justify-between gap-6 shadow-2xl">
            <div className="space-y-1 text-center md:text-left">
              <h3 className="font-black text-xl text-white">Sudah Menjadi Member DagoEng?</h3>
              <p className="text-xs text-slate-300">Buka portal untuk memeriksa saldo poin Anda dan tukarkan voucher reward hari ini.</p>
            </div>
            <Link href="/customer?tab=LOYALTY">
              <Button size="lg" className="h-12 px-7 font-black bg-brand-orange text-white hover:bg-orange-600 rounded-2xl text-xs shadow-lg shadow-orange-500/25">
                Cek Saldo Poin Saya
              </Button>
            </Link>
          </div>

        </div>
      </section>

      {/* 9. SECTION: KONTAK, ALAMAT & SOSIAL MEDIA */}
      <section id="contact" className="py-20 bg-[#0B0F17] border-b border-white/10 text-slate-300 relative">
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
                Platform terpadu F&B, Co-working space, dan Customer Loyalty modern di Bali. Memberikan kenyamanan bekerja dan cita rasa kuliner terbaik.
              </p>
            </div>

            {/* Col 2: Kontak & Alamat */}
            <div className="space-y-2.5 text-xs">
              <h4 className="font-bold text-white uppercase tracking-wider text-xs">Hubungi Kami</h4>
              <div className="flex items-center space-x-2 text-slate-400">
                <MapPin className="w-4 h-4 text-brand-orange flex-shrink-0" />
                <span>Jl. Ngurah Rai No. 45, Singaraja, Bali</span>
              </div>
              <div className="flex items-center space-x-2 text-slate-400">
                <Phone className="w-4 h-4 text-brand-orange flex-shrink-0" />
                <span>+62 811-2233-4455</span>
              </div>
              <div className="flex items-center space-x-2 text-slate-400">
                <Mail className="w-4 h-4 text-brand-orange flex-shrink-0" />
                <span>info@dagoeng.com</span>
              </div>
              <div className="flex items-center space-x-2 text-slate-400">
                <Clock className="w-4 h-4 text-brand-orange flex-shrink-0" />
                <span>Setiap Hari (08:00 - 22:00 WITA)</span>
              </div>
            </div>

            {/* Col 3: Media Sosial Resmi */}
            <div className="space-y-2.5 text-xs">
              <h4 className="font-bold text-white uppercase tracking-wider text-xs">Media Sosial Resmi</h4>
              <p className="text-slate-400 text-[11px]">Ikuti update promo, menu baru, dan event komunitas Dago Creative Hub:</p>
              <div className="flex flex-wrap gap-2 pt-1">
                <a
                  href="https://instagram.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-white/5 border border-white/10 hover:border-brand-orange hover:bg-white/10 text-slate-200 transition-colors"
                >
                  <Instagram className="w-3.5 h-3.5 text-pink-500" />
                  <span>@dagoeng.hub</span>
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

            {/* Col 4: Quick Navigation */}
            <div className="space-y-2 text-xs">
              <h4 className="font-bold text-white uppercase tracking-wider text-xs">Navigasi Langsung</h4>
              <div className="flex flex-col space-y-1.5 text-slate-400">
                <Link href="/customer" className="hover:text-brand-orange transition-colors">Customer Self-Order</Link>
                <Link href="/customer?tab=COWORKING" className="hover:text-brand-orange transition-colors">Reservasi Co-working</Link>
                <Link href="/customer?tab=LOYALTY" className="hover:text-brand-orange transition-colors">Tukar Poin Reward</Link>
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
              <span>Sistem Terintegrasi F&B & Coworking</span>
              <span className="font-mono text-slate-600">v2.5 Enterprise</span>
            </div>
          </div>
        </div>
      </section>

      {/* 10. INTERACTIVE LOGIN MODAL POPUP */}
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

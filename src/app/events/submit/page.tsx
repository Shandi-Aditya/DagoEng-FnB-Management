"use client";

import React, { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import {
  Calendar,
  Clock,
  MapPin,
  Upload,
  UploadCloud,
  RefreshCw,
  X,
  ImagePlus,
  FileImage,
  Link as LinkIcon,
  User,
  Mail,
  Phone,
  Tag,
  FileText,
  DollarSign,
  AlertCircle,
  CheckCircle2,
  ArrowLeft,
  ArrowRight,
  Sparkles,
  Info,
  Ticket,
  Eye,
  Check,
  ShieldCheck,
  Building,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { EventCategory, EventSubmissionPayload } from "@/types/event";
import { formatCurrencyIDR } from "@/lib/utils";

const CATEGORIES: { value: EventCategory; label: string }[] = [
  { value: "WORKSHOP", label: "Workshop & Masterclass" },
  { value: "MEETUP", label: "Komunitas & Meetup" },
  { value: "CREATIVE", label: "Seni & Industri Kreatif" },
  { value: "TECH", label: "Teknologi & Startup" },
  { value: "COMMUNITY", label: "Aksi Sosial & Lingkungan" },
  { value: "SEMINAR", label: "Seminar & Talkshow" },
  { value: "OTHER", label: "Lainnya" },
];

const QUICK_VENUES = [
  "Amphitheater Dago Creative Hub",
  "Main Hall Dago Creative Hub",
  "Tech Lab Dago Hub",
  "Maker Space Dago Hub",
  "Boardroom Ubud (12 Pax)",
  "Meeting Room Seminyak (6 Pax)",
];

const WIZARD_STEPS = [
  { id: 1, title: "Informasi Event", desc: "Judul, kategori & poster" },
  { id: 2, title: "Jadwal & Lokasi", desc: "Waktu & venue acara" },
  { id: 3, title: "Tiket & Kuota", desc: "Harga & kapasitas tiket" },
  { id: 4, title: "Preview & Ajukan", desc: "Tinjau data & kirim" },
];

export default function SubmitEventPage() {
  const router = useRouter();

  // Wizard Step State (1 to 4)
  const [currentStep, setCurrentStep] = useState<number>(1);

  // Form State
  const [formData, setFormData] = useState<EventSubmissionPayload>({
    organizerName: "",
    organizerEmail: "",
    organizerPhone: "",
    title: "",
    category: "COMMUNITY",
    description: "",
    startDate: "",
    endDate: "",
    location: "Amphitheater Dago Creative Hub",
    isPaid: false,
    price: 0,
    maxCapacity: 50,
    posterUrl: "",
    externalRegistrationUrl: "",
    guidelines: "",
    honeypot: "",
  });

  const [posterPreview, setPosterPreview] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState<boolean>(false);
  const [submittedEventId, setSubmittedEventId] = useState<string>("");
  const [stepErrors, setStepErrors] = useState<string[]>([]);
  const [generalError, setGeneralError] = useState<string | null>(null);

  // File Upload & Drag-and-Drop States
  const [isDragging, setIsDragging] = useState(false);
  const [isUploadingPoster, setIsUploadingPoster] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadMode, setUploadMode] = useState<"file" | "url">("file");
  const [uploadedFileName, setUploadedFileName] = useState<string>("");
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const handleFileUpload = async (file: File) => {
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setUploadError("File yang dipilih harus berupa file gambar (JPG, PNG, WEBP, atau GIF).");
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      setUploadError("Ukuran file terlalu besar. Maksimal ukuran gambar adalah 10MB.");
      return;
    }

    try {
      setIsUploadingPoster(true);
      setUploadError(null);

      const body = new FormData();
      body.append("file", file);

      const res = await fetch("/api/events/upload", {
        method: "POST",
        body,
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || "Gagal mengunggah file poster.");
      }

      setFormData((prev) => ({ ...prev, posterUrl: json.url }));
      setPosterPreview(json.url);
      setUploadedFileName(file.name);
    } catch (err: any) {
      setUploadError(err.message || "Terjadi kesalahan saat mengunggah file gambar.");
    } finally {
      setIsUploadingPoster(false);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFileUpload(e.dataTransfer.files[0]);
    }
  };

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));

    if (name === "posterUrl") {
      setPosterPreview(value.trim());
    }
  };

  const handlePricingToggle = (isPaid: boolean) => {
    setFormData((prev) => ({
      ...prev,
      isPaid,
      price: isPaid ? (prev.price && prev.price > 0 ? prev.price : 25000) : 0,
    }));
  };

  // Step-by-Step Validation
  const validateStep = (stepNumber: number): boolean => {
    const errors: string[] = [];

    if (stepNumber === 1) {
      if (!formData.organizerName.trim() || formData.organizerName.trim().length < 2) {
        errors.push("Nama penyelenggara atau komunitas wajib diisi (minimal 2 karakter).");
      }
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!formData.organizerEmail.trim() || !emailRegex.test(formData.organizerEmail.trim())) {
        errors.push("Format email penyelenggara tidak valid.");
      }
      const phoneRegex = /^(\+62|62|0)[0-9\s-]{8,15}$/;
      if (!formData.organizerPhone.trim() || !phoneRegex.test(formData.organizerPhone.trim())) {
        errors.push("Nomor WhatsApp/HP tidak valid (contoh: 08123456789).");
      }
      if (!formData.title.trim() || formData.title.trim().length < 3) {
        errors.push("Judul event wajib diisi (minimal 3 karakter).");
      }
      if (!formData.description.trim() || formData.description.trim().length < 10) {
        errors.push("Deskripsi event wajib diisi (minimal 10 karakter).");
      }
      if (!formData.posterUrl.trim()) {
        errors.push("Poster event wajib diunggah (pilih file atau drag & drop gambar).");
      } else {
        const p = formData.posterUrl.trim();
        if (!p.startsWith("/images/") && !p.startsWith("/uploads/")) {
          try {
            const u = new URL(p);
            if (u.protocol !== "http:" && u.protocol !== "https:") {
              errors.push("URL poster harus menggunakan protokol HTTP atau HTTPS.");
            }
          } catch {
            errors.push("Format URL poster tidak valid.");
          }
        }
      }
    } else if (stepNumber === 2) {
      if (!formData.startDate) {
        errors.push("Tanggal dan waktu mulai wajib diisi.");
      }
      if (!formData.endDate) {
        errors.push("Tanggal dan waktu selesai wajib diisi.");
      }
      if (
        formData.startDate &&
        formData.endDate &&
        new Date(formData.endDate).getTime() < new Date(formData.startDate).getTime()
      ) {
        errors.push("Waktu selesai tidak boleh mendahului waktu mulai acara.");
      }
      if (!formData.location.trim() || formData.location.trim().length < 3) {
        errors.push("Lokasi atau ruangan venue wajib diisi.");
      }
    } else if (stepNumber === 3) {
      if (formData.isPaid && (!formData.price || formData.price <= 0)) {
        errors.push("Harga tiket wajib lebih dari Rp 0 untuk event berbayar.");
      }
      if (formData.maxCapacity && formData.maxCapacity <= 0) {
        errors.push("Kapasitas maksimal harus lebih besar dari 0.");
      }
      if (formData.externalRegistrationUrl?.trim()) {
        try {
          const u = new URL(formData.externalRegistrationUrl.trim());
          if (u.protocol !== "http:" && u.protocol !== "https:") {
            errors.push("URL pendaftaran eksternal harus HTTP atau HTTPS.");
          }
        } catch {
          errors.push("Format URL pendaftaran eksternal tidak valid.");
        }
      }
    }

    setStepErrors(errors);
    return errors.length === 0;
  };

  const handleNextStep = () => {
    if (validateStep(currentStep)) {
      setStepErrors([]);
      setCurrentStep((prev) => Math.min(4, prev + 1));
      window.scrollTo({ top: 120, behavior: "smooth" });
    }
  };

  const handlePrevStep = () => {
    setStepErrors([]);
    setCurrentStep((prev) => Math.max(1, prev - 1));
    window.scrollTo({ top: 120, behavior: "smooth" });
  };

  // Final Submission Handler
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setGeneralError(null);

    // Validate all steps
    if (!validateStep(1) || !validateStep(2) || !validateStep(3)) {
      window.scrollTo({ top: 180, behavior: "smooth" });
      return;
    }

    setIsSubmitting(true);

    try {
      const res = await fetch("/api/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...formData,
          price: formData.isPaid ? Number(formData.price) : 0,
          maxCapacity: formData.maxCapacity ? Number(formData.maxCapacity) : 50,
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        if (data.details && Array.isArray(data.details)) {
          setStepErrors(data.details);
        } else {
          setGeneralError(data.error || "Gagal mengirim pengajuan event.");
        }
        window.scrollTo({ top: 180, behavior: "smooth" });
        return;
      }

      setSubmitSuccess(true);
      setSubmittedEventId(data.data?.id || "");
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (err: any) {
      setGeneralError(err.message || "Terjadi kesalahan jaringan.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] dark:bg-[#0B1120] text-[#1E293B] dark:text-[#E2E8F0] transition-colors duration-200 flex flex-col justify-between">
      {/* Top Navbar */}
      <header className="sticky top-0 z-40 bg-white/90 dark:bg-[#0B1120]/90 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 transition-colors">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <Link
              href="/events"
              className="inline-flex items-center text-xs font-bold text-slate-600 dark:text-slate-400 hover:text-[#3B7A57] dark:hover:text-[#52B788] transition-colors group"
            >
              <ArrowLeft className="w-4 h-4 mr-1.5 transition-transform group-hover:-translate-x-1" />
              <span>Kembali ke Event</span>
            </Link>
            <span className="text-slate-300 dark:text-slate-700">|</span>
            <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
              Buat Event Komunitas
            </span>
          </div>

          <div className="flex items-center space-x-3">
            <ThemeToggle variant="pill" />
            <Link href="/events/portal">
              <Button variant="ghost" size="sm" className="text-xs font-semibold text-slate-600 dark:text-slate-300 hover:text-[#3B7A57]">
                Portal Penyelenggara
              </Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-8 flex-1 w-full">
        {submitSuccess ? (
          /* SUCCESS STATE */
          <Card className="p-8 sm:p-10 border border-emerald-500/30 bg-emerald-50/50 dark:bg-emerald-950/20 text-center shadow-lg rounded-3xl max-w-xl mx-auto">
            <div className="w-16 h-16 mx-auto rounded-2xl bg-emerald-600/10 dark:bg-emerald-500/20 text-[#3B7A57] dark:text-[#52B788] flex items-center justify-center mb-5">
              <CheckCircle2 className="w-9 h-9" />
            </div>

            <Badge variant="outline" className="mb-3 border-emerald-600 text-[#3B7A57] dark:text-[#52B788] font-bold">
              STATUS: PENDING MODERASI
            </Badge>

            <h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight mb-2">
              Pengajuan Event Berhasil Terkirim!
            </h1>

            <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed mb-6 max-w-md mx-auto">
              Event Anda telah tersimpan dan masuk antrean review kurator Dago Creative Hub. Verifikasi agenda biasanya memerlukan waktu 1x24 jam kerja.
            </p>

            <div className="p-4 rounded-2xl bg-white dark:bg-[#1E293B] border border-slate-200 dark:border-slate-800 text-left text-xs space-y-2 mb-8 shadow-xs">
              <div className="flex justify-between">
                <span className="text-slate-500 dark:text-slate-400">ID Pengajuan:</span>
                <span className="font-mono font-bold text-slate-800 dark:text-slate-200">{submittedEventId}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 dark:text-slate-400">Judul Event:</span>
                <span className="font-bold text-slate-800 dark:text-slate-200 truncate max-w-[240px]">
                  {formData.title}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 dark:text-slate-400">Kontak Penyelenggara:</span>
                <span className="text-slate-800 dark:text-slate-200">{formData.organizerPhone}</span>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
              <Link href="/events/portal">
                <Button className="w-full sm:w-auto bg-[#3B7A57] hover:bg-[#2E6044] text-white font-bold text-xs px-5 py-2.5 rounded-xl shadow-md">
                  Buka Portal Penyelenggara
                </Button>
              </Link>
              <Link href="/events">
                <Button variant="outline" className="w-full sm:w-auto text-xs font-semibold rounded-xl border-slate-200 dark:border-slate-700">
                  Lihat Katalog Event
                </Button>
              </Link>
            </div>
          </Card>
        ) : (
          /* 4-STEP WIZARD FORM */
          <div className="space-y-6">
            {/* Header info */}
            <div>
              <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 text-[#3B7A57] dark:text-[#52B788] text-xs font-bold mb-2">
                <Sparkles className="w-3.5 h-3.5" />
                <span>Formulir Pembuatan Event Bergaya Eventbrite</span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight">
                Buat Event Komunitas Baru
              </h1>
              <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed mt-1">
                Lengkapi rincian agenda acara dalam 4 tahapan mudah. Data pengajuan akan otomatis tersinkronisasi di portal organizer Anda.
              </p>
            </div>

            {/* Stepper Progress Bar (Eventbrite Wizard Pattern) */}
            <div className="grid grid-cols-4 gap-2 pt-2">
              {WIZARD_STEPS.map((s) => {
                const isCompleted = currentStep > s.id;
                const isActive = currentStep === s.id;

                return (
                  <div key={s.id} className="space-y-1.5">
                    <div
                      className={`h-1.5 rounded-full transition-all duration-300 ${
                        isCompleted
                          ? "bg-[#3B7A57]"
                          : isActive
                          ? "bg-[#3B7A57]"
                          : "bg-slate-200 dark:bg-slate-800"
                      }`}
                    />
                    <div className="hidden sm:block">
                      <span className={`text-[10px] font-bold block leading-none ${
                        isActive ? "text-[#3B7A57] dark:text-[#52B788]" : "text-slate-400"
                      }`}>
                        Langkah {s.id}
                      </span>
                      <span className={`text-xs font-semibold truncate block mt-0.5 ${
                        isActive ? "text-slate-900 dark:text-white" : "text-slate-500 dark:text-slate-400"
                      }`}>
                        {s.title}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Error alerts */}
            {stepErrors.length > 0 && (
              <div className="p-4 rounded-2xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900 text-rose-800 dark:text-rose-300 text-xs space-y-1 animate-in fade-in">
                <div className="font-bold flex items-center mb-1">
                  <AlertCircle className="w-4 h-4 mr-1.5 flex-shrink-0" />
                  <span>Mohon lengkapi bagian yang wajib diisi:</span>
                </div>
                <ul className="list-disc list-inside space-y-0.5 ml-1">
                  {stepErrors.map((err, idx) => (
                    <li key={idx}>{err}</li>
                  ))}
                </ul>
              </div>
            )}

            {generalError && (
              <div className="p-4 rounded-2xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900 text-rose-800 dark:text-rose-300 text-xs flex items-center">
                <AlertCircle className="w-4 h-4 mr-2 flex-shrink-0" />
                <span>{generalError}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-6">
              {/* HONEYPOT ANTI-SPAM TRAP */}
              <div className="hidden" aria-hidden="true">
                <input
                  type="text"
                  name="honeypot"
                  tabIndex={-1}
                  value={formData.honeypot}
                  onChange={handleInputChange}
                  autoComplete="off"
                />
              </div>

              {/* =============================================================
                  STEP 1: INFORMASI DASAR EVENT
                 ============================================================= */}
              {currentStep === 1 && (
                <Card className="p-6 sm:p-7 bg-white dark:bg-[#1E293B] border border-slate-200 dark:border-slate-800 rounded-3xl shadow-xs space-y-5 animate-in fade-in">
                  <div className="pb-3 border-b border-slate-100 dark:border-slate-800">
                    <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center space-x-2">
                      <span className="w-6 h-6 rounded-lg bg-[#3B7A57] text-white flex items-center justify-center text-xs font-bold">1</span>
                      <span>Informasi Dasar Acara</span>
                    </h2>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                      Berikan judul yang menarik, deskripsi lengkap, dan poster visual acara.
                    </p>
                  </div>

                  {/* Organizer Details */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 p-4 rounded-2xl bg-slate-50 dark:bg-slate-900/60 border border-slate-100 dark:border-slate-800">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                        Nama Komunitas / PIC <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="text"
                        name="organizerName"
                        required
                        value={formData.organizerName}
                        onChange={handleInputChange}
                        placeholder="Contoh: Dago Coffee Lab"
                        className="w-full px-3 py-2 text-xs rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-[#3B7A57] text-slate-800 dark:text-slate-100"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                        Email Penyelenggara <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="email"
                        name="organizerEmail"
                        required
                        value={formData.organizerEmail}
                        onChange={handleInputChange}
                        placeholder="komunitas@dagoeng.com"
                        className="w-full px-3 py-2 text-xs rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-[#3B7A57] text-slate-800 dark:text-slate-100"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                        No. WhatsApp / HP <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="tel"
                        name="organizerPhone"
                        required
                        value={formData.organizerPhone}
                        onChange={handleInputChange}
                        placeholder="08123456789"
                        className="w-full px-3 py-2 text-xs rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-[#3B7A57] text-slate-800 dark:text-slate-100"
                      />
                    </div>
                  </div>

                  {/* Title & Category */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="sm:col-span-2">
                      <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                        Judul Acara <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="text"
                        name="title"
                        required
                        value={formData.title}
                        onChange={handleInputChange}
                        placeholder="Contoh: Latte Art Masterclass & Barista Throwdown 2026"
                        className="w-full px-3.5 py-2.5 text-xs rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-[#3B7A57] text-slate-800 dark:text-slate-100 font-medium"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                        Kategori Acara <span className="text-rose-500">*</span>
                      </label>
                      <select
                        name="category"
                        value={formData.category}
                        onChange={handleInputChange}
                        className="w-full px-3 py-2.5 text-xs rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-[#3B7A57] text-slate-800 dark:text-slate-100 font-medium"
                      >
                        {CATEGORIES.map((c) => (
                          <option key={c.value} value={c.value}>
                            {c.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Description */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                      Deskripsi Lengkap Acara <span className="text-rose-500">*</span>
                    </label>
                    <textarea
                      name="description"
                      required
                      rows={5}
                      value={formData.description}
                      onChange={handleInputChange}
                      placeholder="Jelaskan tujuan acara, target peserta, pemateri, agenda yang akan dipelajari, serta benefit yang didapatkan..."
                      className="w-full px-3.5 py-2.5 text-xs rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-[#3B7A57] text-slate-800 dark:text-slate-100 leading-relaxed"
                    />
                  </div>

                  {/* Poster Upload with Drag & Drop & Live Preview */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                        Poster / Banner Acara <span className="text-rose-500">*</span>
                      </label>
                      <div className="flex items-center space-x-1 text-[11px]">
                        <button
                          type="button"
                          onClick={() => setUploadMode("file")}
                          className={`px-2.5 py-1 rounded-lg font-bold transition-all ${
                            uploadMode === "file"
                              ? "bg-[#3B7A57] text-white shadow-xs"
                              : "text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white"
                          }`}
                        >
                          <Upload className="w-3 h-3 inline mr-1" />
                          Unggah File
                        </button>
                        <button
                          type="button"
                          onClick={() => setUploadMode("url")}
                          className={`px-2.5 py-1 rounded-lg font-bold transition-all ${
                            uploadMode === "url"
                              ? "bg-[#3B7A57] text-white shadow-xs"
                              : "text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white"
                          }`}
                        >
                          <LinkIcon className="w-3 h-3 inline mr-1" />
                          Gunakan URL
                        </button>
                      </div>
                    </div>

                    {uploadMode === "file" ? (
                      <div>
                        {/* Hidden File Input */}
                        <input
                          type="file"
                          ref={fileInputRef}
                          onChange={(e) => {
                            if (e.target.files && e.target.files[0]) {
                              handleFileUpload(e.target.files[0]);
                            }
                          }}
                          accept="image/jpeg,image/png,image/webp,image/gif"
                          className="hidden"
                        />

                        {!posterPreview ? (
                          /* Drag & Drop Zone */
                          <div
                            onDragOver={handleDragOver}
                            onDragLeave={handleDragLeave}
                            onDrop={handleDrop}
                            onClick={() => fileInputRef.current?.click()}
                            className={`relative border-2 border-dashed rounded-2xl p-6 sm:p-8 text-center cursor-pointer transition-all ${
                              isDragging
                                ? "border-[#3B7A57] bg-emerald-50/70 dark:bg-emerald-950/30 scale-[1.01]"
                                : "border-slate-300 dark:border-slate-700 hover:border-[#3B7A57] dark:hover:border-[#52B788] bg-slate-50/50 dark:bg-slate-900/40"
                            }`}
                          >
                            {isUploadingPoster ? (
                              <div className="flex flex-col items-center justify-center space-y-2 py-4">
                                <RefreshCw className="w-8 h-8 text-[#3B7A57] animate-spin" />
                                <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                                  Mengunggah file poster...
                                </span>
                                <span className="text-[10px] text-slate-400">Harap tunggu sebentar</span>
                              </div>
                            ) : (
                              <div className="flex flex-col items-center justify-center space-y-2.5">
                                <div className="w-12 h-12 rounded-2xl bg-emerald-100 dark:bg-emerald-950/60 text-[#3B7A57] dark:text-[#52B788] flex items-center justify-center shadow-xs">
                                  <UploadCloud className="w-6 h-6" />
                                </div>
                                <div>
                                  <span className="text-xs font-bold text-slate-800 dark:text-slate-200 block">
                                    Tarik & letakkan file poster di sini, atau{" "}
                                    <span className="text-[#3B7A57] dark:text-[#52B788] underline underline-offset-2">
                                      Pilih dari Komputer
                                    </span>
                                  </span>
                                  <span className="text-[11px] text-slate-400 block mt-1">
                                    Format didukung: JPG, PNG, WEBP, GIF (Maksimal 10MB)
                                  </span>
                                </div>
                              </div>
                            )}
                          </div>
                        ) : (
                          /* Uploaded Poster Preview Card */
                          <div className="p-3.5 sm:p-4 rounded-2xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-700 flex flex-col sm:flex-row items-center justify-between gap-3.5">
                            <div className="flex items-center space-x-3.5 w-full sm:w-auto">
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img
                                src={posterPreview}
                                alt="Preview Poster"
                                className="w-20 h-20 object-cover rounded-xl border border-slate-200 dark:border-slate-700 shadow-xs shrink-0"
                                onError={() => setPosterPreview("")}
                              />
                              <div className="space-y-1">
                                <div className="flex items-center space-x-1.5 text-xs font-bold text-emerald-600 dark:text-emerald-400">
                                  <CheckCircle2 className="w-3.5 h-3.5" />
                                  <span>Poster Berhasil Dipilih</span>
                                </div>
                                <span className="text-[11px] text-slate-600 dark:text-slate-300 font-mono block truncate max-w-[200px] sm:max-w-xs">
                                  {uploadedFileName || posterPreview}
                                </span>
                                <span className="text-[10px] text-slate-400 block">
                                  Poster siap digunakan untuk halaman detail dan katalog publik.
                                </span>
                              </div>
                            </div>

                            <div className="flex items-center space-x-2 w-full sm:w-auto justify-end">
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => fileInputRef.current?.click()}
                                className="text-xs font-bold rounded-xl h-8 border-slate-200 dark:border-slate-700"
                              >
                                Ganti Gambar
                              </Button>
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  setFormData((prev) => ({ ...prev, posterUrl: "" }));
                                  setPosterPreview("");
                                  setUploadedFileName("");
                                }}
                                className="text-xs font-bold rounded-xl h-8 text-rose-600 border-rose-200 hover:bg-rose-50 dark:border-rose-900/50 dark:hover:bg-rose-950/40"
                              >
                                <X className="w-3.5 h-3.5" />
                              </Button>
                            </div>
                          </div>
                        )}
                      </div>
                    ) : (
                      /* URL Fallback Input */
                      <div className="space-y-2">
                        <input
                          type="url"
                          name="posterUrl"
                          value={formData.posterUrl}
                          onChange={handleInputChange}
                          placeholder="https://images.unsplash.com/... atau tautan gambar online"
                          className="w-full px-3.5 py-2.5 text-xs rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-[#3B7A57] text-slate-800 dark:text-slate-100 font-mono text-[11px]"
                        />

                        {posterPreview && (
                          <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 flex items-center space-x-3.5">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={posterPreview}
                              alt="Preview Poster"
                              className="w-16 h-16 object-cover rounded-xl border border-slate-200 dark:border-slate-700 shadow-xs shrink-0"
                              onError={() => setPosterPreview("")}
                            />
                            <div className="text-xs">
                              <span className="font-bold text-slate-800 dark:text-slate-200 block">Preview Poster Terbaca</span>
                              <span className="text-[10px] text-emerald-600 dark:text-emerald-400">Gambar poster siap ditampilkan di katalog.</span>
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {uploadError && (
                      <div className="p-2.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/50 text-[11px] text-rose-700 dark:text-rose-400 flex items-center space-x-2">
                        <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                        <span>{uploadError}</span>
                      </div>
                    )}
                  </div>
                </Card>
              )}

              {/* =============================================================
                  STEP 2: JADWAL & LOKASI ACARA
                 ============================================================= */}
              {currentStep === 2 && (
                <Card className="p-6 sm:p-7 bg-white dark:bg-[#1E293B] border border-slate-200 dark:border-slate-800 rounded-3xl shadow-xs space-y-5 animate-in fade-in">
                  <div className="pb-3 border-b border-slate-100 dark:border-slate-800">
                    <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center space-x-2">
                      <span className="w-6 h-6 rounded-lg bg-[#3B7A57] text-white flex items-center justify-center text-xs font-bold">2</span>
                      <span>Jadwal & Lokasi Acara</span>
                    </h2>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                      Tentukan waktu mulai, selesai, dan ruangan fasilitas yang digunakan di Dago Hub.
                    </p>
                  </div>

                  {/* Start & End Dates */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                        Waktu Mulai Acara <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="datetime-local"
                        name="startDate"
                        required
                        value={formData.startDate}
                        onChange={handleInputChange}
                        className="w-full px-3.5 py-2.5 text-xs rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-[#3B7A57] text-slate-800 dark:text-slate-100 font-medium"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                        Waktu Selesai Acara <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="datetime-local"
                        name="endDate"
                        required
                        value={formData.endDate}
                        onChange={handleInputChange}
                        className="w-full px-3.5 py-2.5 text-xs rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-[#3B7A57] text-slate-800 dark:text-slate-100 font-medium"
                      />
                    </div>
                  </div>

                  {/* Location Field & Quick Buttons */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                      Ruangan & Lokasi Venue <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      name="location"
                      required
                      value={formData.location}
                      onChange={handleInputChange}
                      placeholder="Contoh: Amphitheater Dago Creative Hub, Singaraja"
                      className="w-full px-3.5 py-2.5 text-xs rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-[#3B7A57] text-slate-800 dark:text-slate-100 font-medium"
                    />

                    {/* Quick Venue Selector */}
                    <div className="pt-2">
                      <span className="text-[10px] text-slate-400 font-semibold block mb-1.5">Pilih Ruangan Fasilitas Dago Hub Cepat:</span>
                      <div className="flex flex-wrap gap-1.5">
                        {QUICK_VENUES.map((v) => (
                          <button
                            key={v}
                            type="button"
                            onClick={() => setFormData((prev) => ({ ...prev, location: v }))}
                            className={`text-[11px] px-2.5 py-1 rounded-lg border font-medium transition-all ${
                              formData.location === v
                                ? "bg-[#3B7A57] text-white border-[#3B7A57]"
                                : "bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-slate-300"
                            }`}
                          >
                            {v}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </Card>
              )}

              {/* =============================================================
                  STEP 3: TIKET, KAPASITAS & PANDUAN
                 ============================================================= */}
              {currentStep === 3 && (
                <Card className="p-6 sm:p-7 bg-white dark:bg-[#1E293B] border border-slate-200 dark:border-slate-800 rounded-3xl shadow-xs space-y-5 animate-in fade-in">
                  <div className="pb-3 border-b border-slate-100 dark:border-slate-800">
                    <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center space-x-2">
                      <span className="w-6 h-6 rounded-lg bg-[#3B7A57] text-white flex items-center justify-center text-xs font-bold">3</span>
                      <span>Tiket, Kapasitas & Ketentuan</span>
                    </h2>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                      Tentukan jenis tiket masuk, harga, kapasitas maksimal kursi, dan panduan untuk peserta.
                    </p>
                  </div>

                  {/* Free vs Paid Toggle Card */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                    <div
                      onClick={() => handlePricingToggle(false)}
                      className={`p-4 rounded-2xl border cursor-pointer transition-all ${
                        !formData.isPaid
                          ? "bg-emerald-50/70 dark:bg-emerald-950/30 border-[#3B7A57] shadow-xs"
                          : "bg-white dark:bg-slate-900/60 border-slate-200 dark:border-slate-700 hover:border-slate-300"
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-bold text-slate-900 dark:text-white">Tiket Gratis (RSVP)</span>
                        {!formData.isPaid && <Check className="w-4 h-4 text-[#3B7A57]" />}
                      </div>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-snug">
                        Peserta dapat mendaftar tanpa biaya. E-Tiket diterbitkan langsung saat registrasi.
                      </p>
                    </div>

                    <div
                      onClick={() => handlePricingToggle(true)}
                      className={`p-4 rounded-2xl border cursor-pointer transition-all ${
                        formData.isPaid
                          ? "bg-emerald-50/70 dark:bg-emerald-950/30 border-[#3B7A57] shadow-xs"
                          : "bg-white dark:bg-slate-900/60 border-slate-200 dark:border-slate-700 hover:border-slate-300"
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-bold text-slate-900 dark:text-white">Tiket Berbayar</span>
                        {formData.isPaid && <Check className="w-4 h-4 text-[#3B7A57]" />}
                      </div>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-snug">
                        Pemesanan berbayar dengan verifikasi lunas sebelum QR check-in aktif.
                      </p>
                    </div>
                  </div>

                  {/* Pricing Input & Revenue Split info */}
                  {formData.isPaid && (
                    <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 space-y-3">
                      <div>
                        <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                          Harga Tiket Masuk (IDR) <span className="text-rose-500">*</span>
                        </label>
                        <input
                          type="number"
                          name="price"
                          min="1000"
                          step="1000"
                          value={formData.price}
                          onChange={handleInputChange}
                          className="w-full px-3.5 py-2 text-xs rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-bold text-slate-900 dark:text-white"
                        />
                      </div>

                      <div className="text-[11px] text-slate-500 dark:text-slate-400 space-y-1 pt-1 border-t border-slate-200/60 dark:border-slate-700/60">
                        <div className="flex justify-between">
                          <span>Estimasi Payout Penyelenggara (80%):</span>
                          <strong className="text-[#3B7A57] dark:text-[#52B788]">
                            {formatCurrencyIDR(Math.round(Number(formData.price || 0) * 0.8))} / tiket
                          </strong>
                        </div>
                        <div className="flex justify-between">
                          <span>Platform Fee Dago Hub (20%):</span>
                          <span>{formatCurrencyIDR(Math.round(Number(formData.price || 0) * 0.2))} / tiket</span>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Capacity & Guidelines */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                        Kapasitas / Kuota Maksimal Peserta
                      </label>
                      <input
                        type="number"
                        name="maxCapacity"
                        min="1"
                        max="500"
                        value={formData.maxCapacity || 50}
                        onChange={handleInputChange}
                        className="w-full px-3.5 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white font-bold"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                        Link Pendaftaran Eksternal (Opsional)
                      </label>
                      <input
                        type="url"
                        name="externalRegistrationUrl"
                        value={formData.externalRegistrationUrl || ""}
                        onChange={handleInputChange}
                        placeholder="https://forms.gle/... (jika ada form khusus)"
                        className="w-full px-3.5 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                      Panduan Khusus Peserta (Opsional)
                    </label>
                    <textarea
                      name="guidelines"
                      rows={2}
                      value={typeof formData.guidelines === "string" ? formData.guidelines : ""}
                      onChange={handleInputChange}
                      placeholder="Contoh: Peserta diharapkan membawa laptop sendiri dengan Node.js terpasang."
                      className="w-full px-3.5 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100"
                    />
                  </div>
                </Card>
              )}

              {/* =============================================================
                  STEP 4: PREVIEW & PENGAJUAN FINAL
                 ============================================================= */}
              {currentStep === 4 && (
                <div className="space-y-6 animate-in fade-in">
                  <Card className="p-6 sm:p-7 bg-white dark:bg-[#1E293B] border border-slate-200 dark:border-slate-800 rounded-3xl shadow-xs space-y-5">
                    <div className="pb-3 border-b border-slate-100 dark:border-slate-800">
                      <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center space-x-2">
                        <span className="w-6 h-6 rounded-lg bg-[#3B7A57] text-white flex items-center justify-center text-xs font-bold">4</span>
                        <span>Pratinjau & Konfirmasi Pengajuan Event</span>
                      </h2>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                        Periksa kembali seluruh data acara Anda sebelum dikirimkan ke tim kurator Dago Creative Hub.
                      </p>
                    </div>

                    {/* Summary Preview Box */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 p-5 rounded-2xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-800">
                      <div className="sm:col-span-1">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={formData.posterUrl}
                          alt="Poster Preview"
                          className="w-full aspect-[16/10] object-cover rounded-xl border border-slate-200 dark:border-slate-700 shadow-xs"
                          onError={(e) => {
                            (e.target as any).src = "https://images.unsplash.com/photo-1511920170033";
                          }}
                        />
                        <div className="mt-2 text-center">
                          <Badge className="bg-[#3B7A57] text-white text-[10px] font-bold">
                            {formData.category}
                          </Badge>
                        </div>
                      </div>

                      <div className="sm:col-span-2 space-y-2 text-xs">
                        <h3 className="text-base font-black text-slate-900 dark:text-white leading-snug">
                          {formData.title}
                        </h3>
                        <p className="text-slate-600 dark:text-slate-400 line-clamp-2 leading-relaxed">
                          {formData.description}
                        </p>

                        <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-200/60 dark:border-slate-700/60 text-[11px]">
                          <div>
                            <span className="text-slate-400 font-semibold block">Waktu Mulai:</span>
                            <span className="font-bold text-slate-800 dark:text-slate-200">
                              {formData.startDate ? new Date(formData.startDate).toLocaleString("id-ID") : "-"}
                            </span>
                          </div>
                          <div>
                            <span className="text-slate-400 font-semibold block">Harga Tiket:</span>
                            <span className="font-bold text-[#3B7A57] dark:text-[#52B788]">
                              {formData.isPaid ? formatCurrencyIDR(formData.price || 0) : "GRATIS (RSVP)"}
                            </span>
                          </div>
                          <div>
                            <span className="text-slate-400 font-semibold block">Ruangan / Lokasi:</span>
                            <span className="font-bold text-slate-800 dark:text-slate-200 truncate block">
                              {formData.location}
                            </span>
                          </div>
                          <div>
                            <span className="text-slate-400 font-semibold block">Kuota Peserta:</span>
                            <span className="font-bold text-slate-800 dark:text-slate-200">
                              {formData.maxCapacity || 50} Kursi
                            </span>
                          </div>
                        </div>

                        <div className="pt-2 text-[11px] text-slate-500">
                          Penyelenggara: <strong className="text-slate-800 dark:text-slate-200">{formData.organizerName}</strong> ({formData.organizerPhone})
                        </div>
                      </div>
                    </div>

                    <div className="p-3.5 bg-emerald-50/70 dark:bg-emerald-950/30 rounded-2xl border border-emerald-200 dark:border-emerald-800 flex items-start space-x-2.5 text-xs text-[#3B7A57] dark:text-[#52B788]">
                      <ShieldCheck className="w-4 h-4 shrink-0 mt-0.5" />
                      <span>
                        Dengan mengirimkan formulir ini, Anda menyetujui pedoman komunitas DAGO Creative Hub. Acara akan otomatis berstatus <strong>PENDING</strong> untuk peninjauan kurator.
                      </span>
                    </div>
                  </Card>
                </div>
              )}

              {/* Wizard Navigation Action Buttons */}
              <div className="flex items-center justify-between pt-2">
                {currentStep > 1 ? (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handlePrevStep}
                    disabled={isSubmitting}
                    className="text-xs font-bold rounded-xl border-slate-200 dark:border-slate-700 px-4 py-2 cursor-pointer"
                  >
                    <ArrowLeft className="w-3.5 h-3.5 mr-1.5" />
                    <span>Langkah Sebelumnya</span>
                  </Button>
                ) : (
                  <div />
                )}

                {currentStep < 4 ? (
                  <Button
                    type="button"
                    onClick={handleNextStep}
                    className="bg-[#3B7A57] hover:bg-[#2E6044] text-white font-bold text-xs rounded-xl px-5 py-2.5 shadow-xs transition-all cursor-pointer"
                  >
                    <span>Lanjut ke Langkah {currentStep + 1}</span>
                    <ArrowRight className="w-3.5 h-3.5 ml-1.5" />
                  </Button>
                ) : (
                  <Button
                    type="submit"
                    disabled={isSubmitting}
                    className="bg-[#3B7A57] hover:bg-[#2E6044] text-white font-bold text-xs rounded-xl px-6 py-2.5 shadow-md shadow-[#3B7A57]/25 transition-all cursor-pointer"
                  >
                    {isSubmitting ? (
                      <span>Mengirim Pengajuan...</span>
                    ) : (
                      <>
                        <CheckCircle2 className="w-4 h-4 mr-1.5" />
                        <span>Kirim Pengajuan Event Sekarang</span>
                      </>
                    )}
                  </Button>
                )}
              </div>
            </form>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-200 dark:border-slate-800 py-6 text-center text-xs text-slate-500 dark:text-slate-400 bg-white/50 dark:bg-[#0B1120]">
        <div className="max-w-5xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-3">
          <p>© {new Date().getFullYear()} Dago Creative Hub — Ekosistem Terpadu F&B, Co-Working & Komunitas.</p>
          <div className="flex items-center space-x-4 font-medium">
            <Link href="/" className="hover:text-slate-800 dark:hover:text-white transition-colors">
              Beranda
            </Link>
            <Link href="/events" className="hover:text-[#3B7A57] dark:hover:text-[#52B788] transition-colors">
              Katalog Event
            </Link>
            <Link href="/events/portal" className="hover:text-[#3B7A57] dark:hover:text-[#52B788] transition-colors">
              Portal Penyelenggara
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
